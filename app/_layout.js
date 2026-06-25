import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ShareIntentProvider, useShareIntentContext, ShareIntentModule } from 'expo-share-intent';
import { hasPendingShares, clearPendingShares } from '../modules/ledge-share-handler';
import { ActivityIndicator, View, Pressable, ScrollView, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { theme } from '../src/constants/theme';
import { useAppStore } from '../src/stores/appStore';
import { useAuthStore } from '../src/stores/authStore';

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

// ---- Crash visibility: show errors instead of silently closing the app ----

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
  static getDerivedStateFromError(error) {
    return { error };
  }
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
        // Show our screen instead of silently aborting
        setFatal(e?.message || String(e));
      } else if (prev) {
        prev(e, isFatal);
      }
    });
    return () => {
      if (prev) ErrorUtils.setGlobalHandler(prev);
    };
  }, []);

  if (fatal) {
    return (
      <CrashScreen
        message={fatal}
        onReset={() => {
          setFatal(null);
          // Force re-initialize auth and stores to clear any corrupted state
          resetAuth();
        }}
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

function RootLayoutInner() {
  const loadProjects = useAppStore((s) => s.loadProjects);
  const loadSettings = useAppStore((s) => s.loadSettings);
  const { session, profile, isLoading, initialize } = useAuthStore();
  const { hasShareIntent, isReady: isShareIntentReady, resetShareIntent } = useShareIntentContext();
  const router = useRouter();
  const segments = useSegments();

  // Initialize auth on mount
  useEffect(() => {
    initialize();
  }, []);

  // ---- NEW: WhatsApp-style native share handler (LedgeShareHandler) ----
  // The native module copies content:// URIs to persistent cache in
  // onCreate/onNewIntent BEFORE the JS layer ever sees them. This eliminates
  // the URI expiry race condition that caused 6 months of intermittent grief.
  // We poll hasPendingShares() every 1.5s when the app is active to detect
  // warm-start shares, and use the result alongside expo-share-intent to decide
  // whether to redirect to /share.
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
        if (!cancelled) setNativeSharePending(false);
      }
    };
    check();
    const interval = setInterval(check, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Load app data once authenticated and password changed
  useEffect(() => {
    if (session && profile && !profile.must_change_password) {
      loadProjects();
      loadSettings();
    }
  }, [session, profile]);

  // A share intent must survive the entire auth flow. On cold start the user
  // may not be signed in yet (→ /login) or may be forced to change their
  // password (→ /change-password); in both cases the native share is delivered
  // before we can show /share. hasShareIntent can also momentarily read false
  // while auth resolves. So we LATCH that a share is pending and only clear it
  // once the user actually reaches /share — this guarantees the share is never
  // lost to a login/password-change/home bounce.
  const pendingShareRef = useRef(false);
  if (hasShareIntent) pendingShareRef.current = true;
  if (nativeSharePending) pendingShareRef.current = true;
  if (segments[0] === 'share') pendingShareRef.current = false;
  const shareIsPending = (hasShareIntent || pendingShareRef.current || nativeSharePending) && segments[0] !== 'share';

  // Auth-gated routing
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'change-password';

    if (!session && !inAuthGroup) {
      // Not authenticated → login
      router.replace('/login');
    } else if (session && profile?.must_change_password && segments[0] !== 'change-password') {
      // Authenticated but must change password
      router.replace('/change-password');
    } else if (session && profile && !profile.must_change_password && inAuthGroup && !shareIsPending) {
      // Authenticated and password changed → go home, unless a share intent is
      // waiting to be handled (prevents the home screen from bouncing in front
      // of the share screen on cold start / right after login).
      router.replace('/');
    }
  }, [session, profile, isLoading, segments, shareIsPending]);

  // Navigate to the share screen once a share is pending AND the user is fully
  // authenticated (signed in + password changed). The latch means this fires
  // even if the share arrived during login or the forced password change.
  useEffect(() => {
    if (isLoading) return;
    if (shareIsPending && session && profile && !profile.must_change_password && segments[0] !== 'share') {
      router.replace('/share');
    }
  }, [shareIsPending, session, profile, segments, isLoading]);

  // Reset the share intent once the user LEAVES the share screen, so a stale
  // intent doesn't re-trigger the redirect/gate on later navigations. We must
  // compare against the previous segment: if we reset whenever we are not on
  // /share, a fresh share intent on another screen can be cleared in the same
  // render that redirects to /share.
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
  }, [segments[0], hasShareIntent, resetShareIntent, nativeSharePending]);

  // Retry reading the native share intent after the JS listeners are ready.
  // expo-share-intent can emit the onChange event before the JS listener
  // attaches on cold start, so the very first share is silently lost and the
  // app lands on home instead of /share. A single retry isn't enough on slow
  // devices, and navigation to /share is also gated on auth being ready — so
  // we poll getShareIntent a few times (and again once session/profile load)
  // until the pending intent is recovered.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (isLoading || !isShareIntentReady || hasShareIntent) return;
    let cancelled = false;
    const attempt = () => {
      if (cancelled || hasShareIntent) return;
      try {
        ShareIntentModule?.getShareIntent('');
      } catch (e) {
        console.warn('ShareIntentModule.getShareIntent retry failed:', e);
      }
    };
    const timers = [300, 900, 1800, 3200].map((d) => setTimeout(attempt, d));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [isLoading, isShareIntentReady, hasShareIntent, session, profile]);

  // Show splash while checking auth
  if (isLoading) {
    return <SplashScreen />;
  }

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
  return (
    <ErrorBoundary>
      <CrashGuard>
        <ShareIntentProvider options={{ resetOnBackground: false, debug: __DEV__ }}>
          <PaperProvider theme={theme}>
            <ThemeProvider value={navigationTheme}>
              <RootLayoutInner />
            </ThemeProvider>
          </PaperProvider>
        </ShareIntentProvider>
      </CrashGuard>
    </ErrorBoundary>
  );
}
