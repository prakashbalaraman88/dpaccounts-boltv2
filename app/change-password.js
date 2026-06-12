import { useState } from 'react';
import { View, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { theme } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';

export default function ChangePasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const changePassword = useAuthStore((s) => s.changePassword);
  const profile = useAuthStore((s) => s.profile);

  const handleChangePassword = async () => {
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both fields');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(newPassword);
      // Auth gate in _layout.js will redirect to home
    } catch (e) {
      console.error('Change password error:', e);
      setError(e.message || 'Failed to change password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.headerSection}>
          <View style={styles.lockIcon}>
            <Text style={styles.lockEmoji}>🔐</Text>
          </View>
          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.subtitle}>
            Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}! Please set a new password to continue.
          </Text>
        </Animated.View>

        {/* Form Card */}
        <Animated.View entering={FadeInDown.delay(300).springify().damping(20)} style={styles.card}>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>NEW PASSWORD</Text>
            <TextInput
              value={newPassword}
              onChangeText={(t) => { setNewPassword(t); setError(''); }}
              style={styles.input}
              mode="outlined"
              placeholder="Minimum 8 characters"
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

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
              style={styles.input}
              mode="outlined"
              placeholder="Re-enter password"
              placeholderTextColor={theme.colors.secondary}
              secureTextEntry={!showPassword}
              outlineColor={theme.colors.outline}
              activeOutlineColor={theme.colors.accent}
              textColor={theme.colors.onSurface}
              outlineStyle={{ borderRadius: 12 }}
              theme={{ roundness: 12 }}
              left={<TextInput.Icon icon="lock-check-outline" color={theme.colors.secondary} />}
            />
          </View>

          <Pressable
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleChangePassword}
            disabled={isLoading}
          >
            <Text style={styles.saveButtonText}>
              {isLoading ? 'Updating...' : 'Set New Password'}
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(600).duration(800)} style={styles.footer}>
          <Text style={styles.footerText}>
            This is required for your first login only
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
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  lockIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.accentContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockEmoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.onBackground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.colors.outline,
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
  saveButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
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
