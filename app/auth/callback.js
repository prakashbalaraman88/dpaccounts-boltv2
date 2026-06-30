import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../src/services/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState('Completing sign-in…');

  useEffect(() => {
    async function handleCallback() {
      try {
        const oauthError = params.error;
        if (oauthError) {
          const desc = params.error_description || oauthError;
          router.replace('/login?oauthError=' + encodeURIComponent(String(desc)));
          return;
        }

        const code = params.code;
        if (!code) {
          router.replace('/login?oauthError=' + encodeURIComponent('No authorization code returned.'));
          return;
        }

        setStatus('Signing you in…');

        let urlToExchange;
        if (Platform.OS === 'web') {
          urlToExchange = window.location.href;
        } else {
          urlToExchange = Linking.createURL('auth/callback', {
            queryParams: { code: String(code) },
          });
        }

        const { error } = await supabase.auth.exchangeCodeForSession(urlToExchange);
        if (error) {
          router.replace('/login?oauthError=' + encodeURIComponent(error.message));
          return;
        }

        router.replace('/');
      } catch (e) {
        router.replace('/login?oauthError=' + encodeURIComponent(e?.message || 'Sign-in failed'));
      }
    }

    handleCallback();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { fontSize: 16, color: '#555' },
});
