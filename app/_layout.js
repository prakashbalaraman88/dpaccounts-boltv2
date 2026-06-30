import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { hasPendingShares, clearPendingShares } from '../modules/ledge-share-handler';
import { ActivityIndicator, View, Pressable, ScrollView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { theme } from '../src/constants/theme';
import { useAppStore } from '../src/stores/appStore';
import { useAuthStore } from '../src/stores/authStore';
import { initializeRevenueCat, SubscriptionProvider } from '../src/services/revenuecat';

const navigationTheme = {
  dark: true,
  colors: {
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.onSurface,
    border: theme.colors.outline,
    notification: theme.colors.primary,
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' },
    medium: { fontFamily: 'System', fontWeight: '500' },
    bold: { fontFamily: 'System', fontWeight: '700' },
    heavy: { fontFamily: 'System', fontWeight: '900' },
  },
};

// ---------------------------------------------------------------------------
// Error handling screens
// ---------------------------------------------------------------------------

function CrashScreen({ message, onReset }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', padding: 28 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 10 }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 13, color: theme.colors.secondary, marginBottom: 16 }}>
        The app hit an unexpected error. Screenshot this and send it to support:
      </Text>
      <ScrollView style={{ maxHeight: 220, backgroundColor: theme.colors.surfaceElevated, borderRadius: 12, padding: 14, marginBottom: 20 }}>
        <Text selectable style={{ fontSize: 12, color: theme.colors.expense, fontFamily: 'monospace' }}>
          {String(message)}
        </Text>
      </ScrollView>
      <Pressable
        onPress={onReset}
        style={{ backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
      >
        <Text style={{ color: '#0A0A0A', fontWeight: '700', fontSize: 15 }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('Render error:', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <CrashScreen
          message={this.state.error?.message || String(this.state.error)}
          onReset={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

function CrashGuard({ children }) {
  const [fatal, setFatal] = useState(null);
  const resetAuth = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const ErrorUtils = global.ErrorUtils;
    if (!ErrorUtils?.setGlobalHandler) return;
    const prev = ErrorUtils.getGlobalHandler?.();
    ErrorUtils.setGlobalHandler((e, isFatal) => {
      console.error('Global error:', e, 'fatal:', isFatal);
      if (isFatal) {
        setFatal(e?.message || String(e));
      } else if (prev) {
        prev(e, isFatal);
      }
    });
    return () => { if (prev) ErrorUtils.setGlobalHandler(prev); };
  }, []);

  if (fatal) {
    return (
      <CrashScreen
        message={fatal}
        onReset={() => { setFatal(null); resetAuth(); }}
      />
    );
  }
  return children;
}

function SplashScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#E8E8E8', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 27, fontWeight: '800', color: '#080808', marginTop: -1 }}>L</Text>
      </View>
      <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginTop: 20 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

function RootLayoutInner() {
  const loadProjects = useAppStore((s) => s.loadProjects);
  const loadSettings = useAppStore((s) => s.loadSettings);
  const { session, profile, isLoading, initialize } = useAuthStore();
  const { hasShareIntent, resetShareIntent } = useShareIntentContext();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => { initialize(); }, []);

  // ---- Load app data once authenticated ----
  useEffect(() => {
    if (session && profile && !profile.must_change_password) {
      loadProjects();
      loadSettings();
    }
  }, [session, profile]);

  // ---- Share intent detection ----
  // We use two signals, whichever fires first:
  //   1. expo-share-intent's hasShareIntent (event-driven)
  //   2. Our native LedgeShareHandler's hasPendingShares() (polled)
  //      The native module copies content:// URIs to file:// in its own
  //      OnCreate/OnNewIntent hooks, so this is always race-free.
  const [nativeSharePending, setNativeSharePending] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      try {
        const has = await hasPendingShares();
        if (!cancelled) setNativeSharePending(has);
      } catch {
        // ignore — module may not be compiled in web/dev builds
      }
    };

    check();
    const interval = setInterval(check, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ---- Share latch ----
  // A share intent must survive the entire auth flow. If the user is not
  // signed in when the intent arrives, they go through /login (and maybe
  // /change-password) before reaching /share. We latch the pending state
  // here so it isn't lost to a login-bounce render cycle.
  const pendingShareRef = useRef(false);
  if (hasShareIntent) pendingShareRef.current = true;
  if (nativeSharePending) pendingShareRef.current = true;
  if (segments[0] === 'share') pendingShareRef.current = false;

  const shareIsPending =
    (hasShareIntent || pendingShareRef.current || nativeSharePending) &&
    segments[0] !== 'share';

  // ---- Auth-gated routing ----
  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'change-password';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && profile?.must_change_password && segments[0] !== 'change-password') {
      router.replace('/change-password');
    } else if (session && profile && !profile.must_change_password && inAuthGroup && !shareIsPending) {
      router.replace('/');
    }
  }, [session, profile, isLoading, segments, shareIsPending]);

  // ---- Navigate to share screen once auth is complete and share is pending ----
  useEffect(() => {
    if (isLoading) return;
    if (
      shareIsPending &&
      session &&
      profile &&
      !profile.must_change_password &&
      segments[0] !== 'share'
    ) {
      router.replace('/share');
    }
  }, [shareIsPending, session, profile, segments, isLoading]);

  // ---- Clean up intent state when leaving /share ----
  const prevSegment = useRef(segments[0]);
  useEffect(() => {
    if (prevSegment.current === 'share' && segments[0] !== 'share') {
      if (hasShareIntent) resetShareIntent();
      if (nativeSharePending) {
        setNativeSharePending(false);
        clearPendingShares();
      }
    }
    prevSegment.current = segments[0];
  }, [segments[0]]);

  if (isLoading) return <SplashScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
          animationDuration: 250,
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  try {
    initializeRevenueCat();
  } catch (err) {
    console.warn('[RevenueCat] Init error:', err?.message ?? err);
  }

  return (
    <ErrorBoundary>
      <CrashGuard>
        <ShareIntentProvider options={{ resetOnBackground: false, debug: __DEV__ }}>
          <PaperProvider theme={theme}>
            <ThemeProvider value={navigationTheme}>
              <SubscriptionProvider>
                <RootLayoutInner />
              </SubscriptionProvider>
            </ThemeProvider>
          </PaperProvider>
        </ShareIntentProvider>
      </CrashGuard>
    </ErrorBoundary>
  );
}
