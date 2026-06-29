import { useState } from 'react';
import { View, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, IconButton } from 'react-native-paper';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { theme } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function LedgeLogo({ size = 56 }) {
  return (
    <View style={[styles.logoContainer, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Text style={[styles.logoLetter, { fontSize: size * 0.48 }]}>L</Text>
    </View>
  );
}

function GoogleIcon({ size = 20 }) {
  return (
    <View style={styles.googleIconWrapper}>
      <IconButton icon="google" size={size} iconColor="#4285F4" style={{ margin: 0 }} />
    </View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((s) => s.login);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter email and password');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      console.error('Login error:', e);
      const msg = e.message || '';
      if (msg === 'Invalid login credentials') {
        setError('Invalid email or password');
      } else if (/failed to fetch|network|name.*resolved/i.test(msg)) {
        setError('Cannot reach the server. Check your internet connection.');
      } else {
        setError(msg || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      const profile = await loginWithGoogle();
      if (!profile) {
        // User cancelled the browser — do nothing
      }
    } catch (e) {
      console.error('Google Sign-In error:', e);
      const msg = e.message || '';
      if (/cancelled|cancel/i.test(msg)) {
        // silent cancel
      } else if (/network|fetch/i.test(msg)) {
        setError('Network error. Check your connection and try again.');
      } else {
        setError('Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const isAnyLoading = isLoading || isGoogleLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(40, insets.top + 24), paddingBottom: Math.max(40, insets.bottom + 24) },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Logo & Branding */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.brandSection}>
          <LedgeLogo size={64} />
          <Text style={styles.brandName}>ledge</Text>
          <Text style={styles.brandTagline}>Interior Design Accounts</Text>
        </Animated.View>

        {/* Login Card */}
        <Animated.View entering={FadeInDown.delay(300).duration(380)} style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>Continue with Google or your credentials</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Google Sign-In Button */}
          <Pressable
            style={[styles.googleButton, isGoogleLoading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={isAnyLoading}
          >
            <GoogleIcon size={18} />
            <Text style={styles.googleButtonText}>
              {isGoogleLoading ? 'Opening Google…' : 'Continue with Google'}
            </Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              style={styles.input}
              mode="outlined"
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.secondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.accent}
              textColor={theme.colors.onSurface}
              outlineStyle={{ borderRadius: 12 }}
              theme={{ roundness: 12 }}
              left={<TextInput.Icon icon="email-outline" color={theme.colors.secondary} />}
            />
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              style={styles.input}
              mode="outlined"
              placeholder="Enter password"
              placeholderTextColor={theme.colors.secondary}
              secureTextEntry={!showPassword}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.accent}
              textColor={theme.colors.onSurface}
              outlineStyle={{ borderRadius: 12 }}
              theme={{ roundness: 12 }}
              left={<TextInput.Icon icon="lock-outline" color={theme.colors.secondary} />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  color={theme.colors.secondary}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
            />
          </View>

          {/* Email Sign-In Button */}
          <Pressable
            style={[styles.signInButton, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isAnyLoading}
          >
            <Text style={styles.signInButtonText}>
              {isLoading ? 'Signing In…' : 'Sign In with Email'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeIn.delay(600).duration(800)} style={styles.footer}>
          <Text style={styles.footerText}>
            New users: sign in with Google to get started
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoLetter: {
    color: '#080808',
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: -1,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.onBackground,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 14,
    color: theme.colors.secondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors.secondary,
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: theme.colors.expenseMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: theme.colors.expense,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Google button ────────────────────────────────────────────────
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
  },
  googleIconWrapper: {
    marginRight: -4,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // ── Divider ──────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.outline,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.secondary,
    letterSpacing: 1,
  },

  // ── Email form ───────────────────────────────────────────────────
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.secondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    fontSize: 15,
  },
  signInButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#080808',
  },

  // ── Footer ───────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
});
