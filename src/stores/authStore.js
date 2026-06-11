import { create } from 'zustand';
import {
  signIn,
  signOut,
  changePassword as changePasswordService,
  getSession,
  getUserProfile,
  onAuthStateChange,
} from '../services/auth';

export const useAuthStore = create((set, get) => ({
  // State
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,

  /**
   * Initialize auth state — called once on app start
   * Checks for existing session and fetches profile
   */
  initialize: async () => {
    try {
      set({ isLoading: true });

      const session = await getSession();
      if (session?.user) {
        const profile = await getUserProfile(session.user.id);
        set({
          session,
          user: session.user,
          profile,
          isAdmin: profile?.role === 'admin',
          isLoading: false,
        });
      } else {
        set({ session: null, user: null, profile: null, isAdmin: false, isLoading: false });
      }

      // Listen for auth changes (token refresh, sign out, etc.)
      onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          set({ session: null, user: null, profile: null, isAdmin: false });
        } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          if (session?.user) {
            try {
              const profile = await getUserProfile(session.user.id);
              set({
                session,
                user: session.user,
                profile,
                isAdmin: profile?.role === 'admin',
              });
            } catch (e) {
              console.error('Error fetching profile on auth change:', e);
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
    const profile = await getUserProfile(data.user.id);
    set({
      session: data.session,
      user: data.user,
      profile,
      isAdmin: profile?.role === 'admin',
    });
    return profile;
  },

  /**
   * Logout — clears session and redirects to login
   */
  logout: async () => {
    await signOut();
    set({ session: null, user: null, profile: null, isAdmin: false });
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
   * Refresh profile data from Supabase
   */
  refreshProfile: async () => {
    const { user } = get();
    if (user) {
      const profile = await getUserProfile(user.id);
      set({ profile, isAdmin: profile?.role === 'admin' });
    }
  },
}));
