import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { User, Session } from '@supabase/supabase-js'
import { authService } from '@/lib/api'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean

  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  setInitialized: (initialized: boolean) => void
  signOut: () => Promise<void>
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        session: null,
        loading: true,
        initialized: false,

        setUser: (user) => set({ user }),

        setSession: (session) => set({ session, user: session?.user || null }),

        setLoading: (loading) => set({ loading }),

        setInitialized: (initialized) => set({ initialized }),

        signOut: async () => {
          set({ loading: true })
          try {
            await authService.signOut()
            get().reset()
          } catch (error) {
            console.error('Error signing out:', error)
          } finally {
            set({ loading: false })
          }
        },

        reset: () =>
          set({
            user: null,
            session: null,
            loading: false,
            initialized: true
          })
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          session: state.session
        })
      }
    ),
    { name: 'AuthStore' }
  )
)
