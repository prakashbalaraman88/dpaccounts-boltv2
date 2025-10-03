import { supabase, isSupabaseConfigured } from './client'
import type { User, Session, AuthError } from '@supabase/supabase-js'

export interface SignUpData {
  email: string
  password: string
  fullName?: string
  phone?: string
  companyName?: string
}

export interface SignInData {
  email: string
  password: string
}

export interface AuthResponse<T = User> {
  data: T | null
  error: AuthError | Error | null
}

export interface SessionResponse {
  data: { user: User; session: Session } | null
  error: AuthError | Error | null
}

class AuthService {
  async signUp(data: SignUpData): Promise<SessionResponse> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured. Please check your environment variables.')
      }
    }

    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone: data.phone,
            company_name: data.companyName
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        return { data: null, error }
      }

      if (!authData.user || !authData.session) {
        return {
          data: null,
          error: new Error('Sign up succeeded but no user data returned')
        }
      }

      return {
        data: {
          user: authData.user,
          session: authData.session
        },
        error: null
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error during sign up')
      }
    }
  }

  async signIn(data: SignInData): Promise<SessionResponse> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured. Please check your environment variables.')
      }
    }

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      })

      if (error) {
        return { data: null, error }
      }

      if (!authData.user || !authData.session) {
        return {
          data: null,
          error: new Error('Sign in succeeded but no user data returned')
        }
      }

      return {
        data: {
          user: authData.user,
          session: authData.session
        },
        error: null
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error during sign in')
      }
    }
  }

  async signOut(): Promise<{ error: AuthError | Error | null }> {
    if (!isSupabaseConfigured()) {
      return {
        error: new Error('Supabase is not configured')
      }
    }

    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Unknown error during sign out')
      }
    }
  }

  async getCurrentUser(): Promise<AuthResponse> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured')
      }
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      return { data: user, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error getting user')
      }
    }
  }

  async getSession(): Promise<{ data: Session | null; error: AuthError | Error | null }> {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: new Error('Supabase is not configured')
      }
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      return { data: session, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error getting session')
      }
    }
  }

  async resetPassword(email: string): Promise<{ error: AuthError | Error | null }> {
    if (!isSupabaseConfigured()) {
      return {
        error: new Error('Supabase is not configured')
      }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      return { error }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Unknown error resetting password')
      }
    }
  }

  async updatePassword(newPassword: string): Promise<{ error: AuthError | Error | null }> {
    if (!isSupabaseConfigured()) {
      return {
        error: new Error('Supabase is not configured')
      }
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      return { error }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Unknown error updating password')
      }
    }
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured, auth state changes will not be tracked')
      return { data: { subscription: { unsubscribe: () => {} } } }
    }

    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session)
    })
  }
}

export const authService = new AuthService()
export default authService
