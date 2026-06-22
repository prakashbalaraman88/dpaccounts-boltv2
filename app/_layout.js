import 'react-native-url-polyfill/auto';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ShareIntentProvider, useShareIntentContext, ShareIntentModule } from 'expo-share-intent';
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

  useEffect(() => {
    const ErrorUtils = global.ErrorUtils;
    if (!ErrorUtils?.setGlobalHandler) return;
    const prev = ErrorUtils.getGlobalHandler?.();
    ErrorUtils.setGlobalHandler((e, isFatal) => {
      console.error('Global error:', e, 'fatal:', isFatal);
      if (isFatal) {
        // Swallow the fatal: render our screen instead of letting RN abort
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
    return <CrashScreen message={fatal} onReset={() => setFatal(null)} />;
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

  // Load app data once authenticated and password changed
  useEffect(() => {
    if (session && profile && !profile.must_change_password) {
      loadProjects();
      loadSettings();
    }
  }, [session, profile]);

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
    } else if (session && profile && !profile.must_change_password && inAuthGroup) {
      // Authenticated and password changed → go home
      router.replace('/');
    }
  }, [session, profile, isLoading, segments]);

  // Navigate to share screen when a share intent is detected (Android) — only when authenticated
  useEffect(() => {
    if (hasShareIntent && session && profile && !profile.must_change_password && segments[0] !== 'share') {
      router.replace('/share');
    }
  }, [hasShareIntent, session, profile, segments]);

  // Reset the share intent once the user LEAVES the share screen, so a stale
  // intent doesn't re-trigger the redirect/gate on later navigations. We must
  // compare against the previous segment: if we reset whenever we are not on
  // /share, a fresh share intent on another screen can be cleared in the same
  // render that redirects to /share.
  const prevSegment = useRef(segments[0]);
  useEffect(() => {
    if (prevSegment.current === 'share' && segments[0] !== 'share' && hasShareIntent) {
      resetShareIntent();
    }
    prevSegment.current = segments[0];
  }, [segments[0], hasShareIntent, resetShareIntent]);

  // Retry reading the native share intent after the JS listeners are ready.
  // expo-share-intent can emit the event before the listener attaches on cold start.
  useEffect(() => {
    if (!isShareIntentReady || Platform.OS !== 'android') return;
    const timer = setTimeout(() => {
      if (!hasShareIntent) {
        ShareIntentModule?.getShareIntent('');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [isShareIntentReady, hasShareIntent]);

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
