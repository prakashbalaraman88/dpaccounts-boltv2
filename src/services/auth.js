import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from './supabase';

// Required for the OAuth browser session to complete on iOS
WebBrowser.maybeCompleteAuthSession();

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with Google via Supabase OAuth + expo-web-browser (PKCE flow).
 *
 * Prerequisites for this to work end-to-end:
 *   1. Google Cloud Console → OAuth client → Authorized Redirect URIs must include:
 *      https://sdnarwantjvwqzkaxwhc.supabase.co/auth/v1/callback
 *   2. Supabase Dashboard → Auth → Providers → Google must be enabled with a
 *      valid Client ID and Client Secret from the Google Cloud Console.
 *
 * Returns session data on success, or null if the user cancelled.
 */
export async function signInWithGoogle() {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'interiorbooks',
    path: 'auth/callback',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('Google Sign-In: no OAuth URL returned from Supabase');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return null; // user cancelled — not an error
  }

  if (result.type !== 'success' || !result.url) {
    throw new Error('Google Sign-In was not completed');
  }

  // Check if the callback URL contains an OAuth error before trying to exchange.
  // The most common case is redirect_uri_mismatch when Google Cloud Console is
  // missing the Supabase callback URL in Authorized Redirect URIs.
  const callbackUrl = new URL(result.url);
  const oauthError = callbackUrl.searchParams.get('error');
  const oauthErrorDesc = callbackUrl.searchParams.get('error_description');
  if (oauthError) {
    if (oauthError === 'redirect_uri_mismatch') {
      throw new Error(
        'Google OAuth is not fully configured: the Supabase callback URL is missing from ' +
        'Authorized Redirect URIs in Google Cloud Console. ' +
        'Add https://sdnarwantjvwqzkaxwhc.supabase.co/auth/v1/callback and try again.'
      );
    }
    throw new Error(
      `Google Sign-In failed: ${oauthErrorDesc || oauthError}`
    );
  }

  // The PKCE code must be present for the exchange to succeed.
  const code = callbackUrl.searchParams.get('code');
  if (!code) {
    throw new Error(
      'Google Sign-In: no authorization code was returned in the callback URL'
    );
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.exchangeCodeForSession(result.url);

  if (sessionError) {
    console.error('[Auth] exchangeCodeForSession error:', sessionError.message);
    throw sessionError;
  }

  if (!sessionData?.session) {
    throw new Error('Google Sign-In: session exchange succeeded but no session was returned');
  }

  return sessionData;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Change the current user's password and clear must_change_password flag
 */
export async function changePassword(newPassword) {
  const { error: authError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (authError) throw authError;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (profileError) throw profileError;
  }
}

/**
 * Get the current session (returns null if not authenticated)
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Get the current authenticated user
 */
export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Fetch user profile from the profiles table.
 * For new OAuth users (no row yet), auto-creates a default viewer profile.
 */
export async function getUserProfile(userId, oauthMeta = null) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // PGRST116 = "no rows returned" — new OAuth user, create their profile
  if (error && error.code === 'PGRST116') {
    const displayName =
      oauthMeta?.full_name ||
      oauthMeta?.name ||
      oauthMeta?.email ||
      '';

    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        role: 'viewer',
        display_name: displayName,
        must_change_password: false,
      })
      .select()
      .single();

    if (createError) throw createError;
    return newProfile;
  }

  if (error) throw error;
  return data;
}

/**
 * Listen for auth state changes (login, logout, token refresh)
 * Returns an unsubscribe function
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    }
  );
  return () => subscription.unsubscribe();
}
