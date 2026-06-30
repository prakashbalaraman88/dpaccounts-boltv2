import { create } from 'zustand';
import {
  signIn,
  signInWithGoogle,
  signOut,
  changePassword as changePasswordService,
  getSession,
  getUserProfile,
  onAuthStateChange,
  ProfileCreationError,
} from '../services/auth';
import { identifyRevenueCatUser, logoutRevenueCatUser } from '../services/revenuecat';

// Module-level reference to the active auth state subscription.
// Stored outside the store so it survives store re-renders and can be
// cleaned up if initialize() is called more than once (e.g. after a crash).
let _authUnsubscribe = null;

export const useAuthStore = create((set, get) => ({
  // State
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  profileError: null,

  /**
   * Initialize auth state — called once on app start.
   * Checks for existing session and fetches profile.
   */
  initialize: async () => {
    try {
      set({ isLoading: true });

      const session = await getSession();
      if (session?.user) {
        try {
          const profile = await getUserProfile(
            session.user.id,
            session.user.user_metadata
          );
          set({
            session,
            user: session.user,
            profile,
            isAdmin: profile?.role === 'admin',
            isLoading: false,
            profileError: null,
          });
          identifyRevenueCatUser(session.user.id);
        } catch (profileErr) {
          if (profileErr instanceof ProfileCreationError) {
            console.error('[Auth] Profile creation failed on init, signing out:', profileErr);
            await signOut().catch(() => {});
            set({
              session: null,
              user: null,
              profile: null,
              isAdmin: false,
              isLoading: false,
              profileError:
                'We could not finish setting up your account. Please sign in again or contact support.',
            });
          } else {
            throw profileErr;
          }
        }
      } else {
        set({ session: null, user: null, profile: null, isAdmin: false, isLoading: false, profileError: null });
      }

      // Tear down any existing listener before re-subscribing so that calling
      // initialize() more than once (e.g. after a crash recovery) never stacks
      // up duplicate listeners.
      if (_authUnsubscribe) {
        _authUnsubscribe();
        _authUnsubscribe = null;
      }

      // Listen for auth changes (token refresh, sign-out, OAuth callback)
      _authUnsubscribe = onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          set({ session: null, user: null, profile: null, isAdmin: false });
          logoutRevenueCatUser();
        } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          if (session?.user) {
            try {
              const profile = await getUserProfile(
                session.user.id,
                session.user.user_metadata
              );
              set({
                session,
                user: session.user,
                profile,
                isAdmin: profile?.role === 'admin',
                profileError: null,
              });
              identifyRevenueCatUser(session.user.id);
            } catch (e) {
              if (e instanceof ProfileCreationError) {
                console.error('[Auth] Profile creation failed on auth change, signing out:', e);
                await signOut().catch(() => {});
                set({
                  session: null,
                  user: null,
                  profile: null,
                  isAdmin: false,
                  profileError:
                    'We could not finish setting up your account. Please sign in again or contact support.',
                });
                logoutRevenueCatUser();
              } else {
                console.error('Error fetching/creating profile on auth change:', e);
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ session: null, user: null, profile: null, isAdmin: false, isLoading: false });
    }
  },

  /**
   * Login with email and password
   */
  login: async (email, password) => {
    const data = await signIn(email, password);
    const profile = await getUserProfile(data.user.id, data.user.user_metadata);
    set({
      session: data.session,
      user: data.user,
      profile,
      isAdmin: profile?.role === 'admin',
    });
    identifyRevenueCatUser(data.user.id);
    return profile;
  },

  /**
   * Login with Google OAuth.
   * Opens a browser; returns null if the user cancels.
   * The onAuthStateChange listener will update the store once the session lands.
   */
  loginWithGoogle: async () => {
    const data = await signInWithGoogle();
    if (!data) return null; // user cancelled

    // onAuthStateChange handles store updates, but we also update here
    // immediately to avoid a blank render while the listener fires.
    try {
      const profile = await getUserProfile(data.user.id, data.user.user_metadata);
      set({
        session: data.session,
        user: data.user,
        profile,
        isAdmin: profile?.role === 'admin',
        profileError: null,
      });
      identifyRevenueCatUser(data.user.id);
      return profile;
    } catch (e) {
      if (e instanceof ProfileCreationError) {
        console.error('[Auth] Profile creation failed during Google login, signing out:', e);
        await signOut().catch(() => {});
        set({ session: null, user: null, profile: null, isAdmin: false });
        logoutRevenueCatUser();
        throw e; // re-throw so login.js can surface a friendly message
      }
      throw e;
    }
  },

  /**
   * Logout — clears session and redirects to login
   */
  logout: async () => {
    await signOut();
    set({ session: null, user: null, profile: null, isAdmin: false });
    logoutRevenueCatUser();
  },

  /**
   * Change password — updates auth password and clears must_change_password flag
   */
  changePassword: async (newPassword) => {
    await changePasswordService(newPassword);
    const { profile } = get();
    if (profile) {
      set({ profile: { ...profile, must_change_password: false } });
    }
  },

  /**
   * Clear the profileError banner (e.g. when the user dismisses it or retries)
   */
  clearProfileError: () => set({ profileError: null }),

  /**
   * Refresh profile data from Supabase
   */
  refreshProfile: async () => {
    const { user } = get();
    if (user) {
      const profile = await getUserProfile(user.id, user.user_metadata);
      set({ profile, isAdmin: profile?.role === 'admin' });
    }
  },
}));
