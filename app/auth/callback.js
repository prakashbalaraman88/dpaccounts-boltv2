import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/services/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Completing sign-in…');

  useEffect(() => {
    async function handleCallback() {
      try {
        const url = window.location.href;
        const params = new URL(url).searchParams;

        const oauthError = params.get('error');
        if (oauthError) {
          const desc = params.get('error_description') || oauthError;
          router.replace('/login?oauthError=' + encodeURIComponent(desc));
          return;
        }

        const code = params.get('code');
        if (!code) {
          router.replace('/login?oauthError=' + encodeURIComponent('No authorization code returned.'));
          return;
        }

        setStatus('Signing you in…');
        const { error } = await supabase.auth.exchangeCodeForSession(url);
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
