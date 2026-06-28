import { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, Linking, ScrollView, KeyboardAvoidingView } from 'react-native';
import { Text, TextInput, IconButton } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { theme } from '../src/constants/theme';
import { useAppStore } from '../src/stores/appStore';
import { useAuthStore } from '../src/stores/authStore';

function AnimatedButton({ onPress, disabled, children, style }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animStyle, disabled && { opacity: 0.4 }]}>
      <Pressable
        style={style}
        onPressIn={() => {
          if (!disabled) scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { aiApiKey, setAiApiKey } = useAppStore();
  const { profile, isAdmin, logout } = useAuthStore();
  const [apiKey, setApiKey] = useState(aiApiKey);
  const [saved, setSaved] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const providerName = useMemo(() => {
    if (!apiKey) return 'OpenRouter / WaveSpeed';
    if (apiKey.startsWith('sk-or-v1-')) return 'OpenRouter';
    return 'WaveSpeed';
  }, [apiKey]);

  // Sync local state when store loads the persisted key
  useEffect(() => {
    if (aiApiKey && !apiKey) {
      setApiKey(aiApiKey);
    }
  }, [aiApiKey]);

  const checkScale = useSharedValue(1);
  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const handleSave = async () => {
    await setAiApiKey(apiKey.trim());
    setSaved(true);
    checkScale.value = withSequence(
      withSpring(1.2, { damping: 8 }),
      withSpring(1, { damping: 12 })
    );
    setTimeout(() => setSaved(false), 2500);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // Auth gate in _layout.js will redirect to login
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
        >
          <IconButton
            icon="arrow-left"
            iconColor={theme.colors.onSurface}
            size={22}
            style={{ margin: 0 }}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </Animated.View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled" bounces={false}>

        {/* Account Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(260)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.accentContainer }]}>
              <IconButton icon="account-circle-outline" iconColor={theme.colors.accent} size={20} style={{ margin: 0 }} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Account</Text>
              <Text style={styles.sectionTag}>{isAdmin ? 'Administrator' : 'User'}</Text>
            </View>
          </View>

          <View style={styles.aboutItems}>
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Email</Text>
              <Text style={styles.aboutValue} numberOfLines={1}>{profile?.email || '—'}</Text>
            </View>
            <View style={styles.aboutDivider} />
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Name</Text>
              <Text style={styles.aboutValue} numberOfLines={1}>{profile?.display_name || '—'}</Text>
            </View>
            <View style={styles.aboutDivider} />
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Role</Text>
              <Text style={[styles.aboutValue, isAdmin && { color: theme.colors.accent }]} numberOfLines={1}>
                {profile?.role || '—'}
              </Text>
            </View>
          </View>

          <Pressable style={styles.changePasswordButton} onPress={() => router.push('/change-password')}>
            <IconButton icon="lock-reset" iconColor={theme.colors.primary} size={18} style={{ margin: 0 }} />
            <Text style={styles.changePasswordText}>Change Password</Text>
          </Pressable>
        </Animated.View>

        {/* API Section — Admin only can edit */}
        <Animated.View entering={FadeInDown.delay(200).duration(260)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <IconButton icon="key-variant" iconColor={theme.colors.primary} size={20} style={{ margin: 0 }} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>AI API Key</Text>
              <Text style={styles.sectionTag}>{providerName}</Text>
            </View>
          </View>

          {isAdmin ? (
            <>
              <Text style={styles.sectionDesc}>
                Enter your AI provider API key. Supports WaveSpeed (wsk_...) for fast, reliable analysis, or OpenRouter (sk-or-v1-...) for free vision models. Simple messages are parsed on-device; the AI handles receipts and tricky phrasing.
              </Text>

              <Pressable
                style={styles.linkButton}
                onPress={() => Linking.openURL('https://wavespeed.ai/accesskey')}
              >
                <Text style={styles.linkText}>Get a WaveSpeed API key</Text>
                <IconButton icon="open-in-new" iconColor={theme.colors.primary} size={14} style={{ margin: 0 }} />
              </Pressable>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>API Key</Text>
                <TextInput
                  value={apiKey}
                  onChangeText={setApiKey}
                  style={styles.input}
                  mode="outlined"
                  placeholder="Enter your WaveSpeed or OpenRouter API key"
                  placeholderTextColor={theme.colors.secondary}
                  secureTextEntry
                  outlineColor={theme.colors.outline}
                  activeOutlineColor={theme.colors.primary}
                  textColor={theme.colors.onSurface}
                  outlineStyle={styles.inputOutline}
                  theme={{ roundness: 12 }}
                  right={
                    <TextInput.Icon
                      icon={apiKey ? 'check-circle' : 'key'}
                      color={apiKey ? theme.colors.incoming : theme.colors.secondary}
                      size={20}
                    />
                  }
                />
              </View>

              <AnimatedButton
                onPress={handleSave}
                disabled={!apiKey.trim()}
                style={[styles.saveButton, saved && styles.saveButtonSaved]}
              >
                {saved ? (
                  <Animated.View style={[styles.saveButtonContent, checkAnimStyle]}>
                    <IconButton icon="check" iconColor="#0A0A0A" size={18} style={{ margin: 0 }} />
                    <Text style={styles.saveButtonText}>Saved!</Text>
                  </Animated.View>
                ) : (
                  <View style={styles.saveButtonContent}>
                    <Text style={styles.saveButtonText}>Save API Key</Text>
                  </View>
                )}
              </AnimatedButton>
            </>
          ) : (
            <View style={styles.apiStatus}>
              <IconButton
                icon={aiApiKey ? 'check-circle' : 'alert-circle-outline'}
                iconColor={aiApiKey ? theme.colors.incoming : theme.colors.expense}
                size={20}
                style={{ margin: 0 }}
              />
              <Text style={[styles.apiStatusText, { color: aiApiKey ? theme.colors.incoming : theme.colors.expense }]}>
                {aiApiKey ? 'API key configured by admin' : 'API key not configured — contact admin'}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* About Section */}
        <Animated.View entering={FadeInDown.delay(300).duration(260)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <IconButton icon="information-outline" iconColor={theme.colors.primary} size={20} style={{ margin: 0 }} />
            </View>
            <View>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.sectionTag}>v1.0.0</Text>
            </View>
          </View>

          <View style={styles.aboutItems}>
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>App Name</Text>
              <Text style={styles.aboutValue} numberOfLines={1}>Ledge</Text>
            </View>
            <View style={styles.aboutDivider} />
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Purpose</Text>
              <Text style={styles.aboutValue} numberOfLines={2}>Accounts Manager{'\n'}for Interior Design</Text>
            </View>
            <View style={styles.aboutDivider} />
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Currency</Text>
              <Text style={styles.aboutValue} numberOfLines={1}>Indian Rupees (₹)</Text>
            </View>
          </View>
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeInDown.delay(400).duration(260)}>
          <Pressable
            style={[styles.logoutButton, isLoggingOut && { opacity: 0.6 }]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            <IconButton icon="logout" iconColor={theme.colors.expense} size={20} style={{ margin: 0 }} />
            <Text style={styles.logoutText}>
              {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
            </Text>
          </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.onSurface,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  contentContainer: {
    gap: 14,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    letterSpacing: 0.2,
  },
  sectionTag: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  sectionDesc: {
    fontSize: 13,
    color: theme.colors.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  linkText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.colors.surface,
    fontSize: 14,
  },
  inputOutline: { borderRadius: 12 },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonSaved: {
    backgroundColor: theme.colors.incoming,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0A0A',
    letterSpacing: 0.3,
  },
  apiStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  apiStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
    paddingVertical: 8,
  },
  changePasswordText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  aboutItems: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: theme.colors.outline,
    marginHorizontal: 16,
  },
  aboutLabel: {
    fontSize: 13,
    color: theme.colors.secondary,
    fontWeight: '500',
    minWidth: 80,
  },
  aboutValue: {
    fontSize: 13,
    color: theme.colors.onSurface,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.expenseMuted,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.15)',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.expense,
  },
});
