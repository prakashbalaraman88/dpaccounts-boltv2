import { useState } from 'react';
import { View, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { theme } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';

function LedgeLogo({ size = 56 }) {
  return (
    <View style={[styles.logoContainer, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Text style={[styles.logoLetter, { fontSize: size * 0.48 }]}>L</Text>
    </View>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((s) => s.login);

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
      setError(e.message === 'Invalid login credentials'
        ? 'Invalid email or password'
        : e.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        <Animated.View entering={FadeInDown.delay(300).springify().damping(20)} style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>Enter your credentials to continue</Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

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

          <Pressable
            style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.signInButtonText}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeIn.delay(600).duration(800)} style={styles.footer}>
          <Text style={styles.footerText}>
            Contact your admin for account access
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
    marginBottom: 24,
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
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#080808',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.secondary,
  },
});
