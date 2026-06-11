import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { ActivityIndicator, View } from 'react-native';
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
  const { hasShareIntent } = useShareIntentContext();
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
  }, [hasShareIntent, session, profile]);

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
    <ShareIntentProvider options={{ resetOnBackground: false }}>
      <PaperProvider theme={theme}>
        <ThemeProvider value={navigationTheme}>
          <RootLayoutInner />
        </ThemeProvider>
      </PaperProvider>
    </ShareIntentProvider>
  );
}
