import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  profile: any | null
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    profile: null
  })

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { authService: auth, supabase } = await import('@/lib/api')

        const { data: sessionData } = await auth.getSession()
        const session = sessionData

        if (session?.user) {
          const user = session.user

          try {
            const { db } = await import('@/lib/api')
            const { data: profile } = await db.getProfile(user.id)
            setAuthState({
              user,
              session,
              loading: false,
              profile: profile || {
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
              }
            })
          } catch (profileError) {
            console.warn('Profile fetch error, using default profile:', profileError)
            setAuthState({
              user,
              session,
              loading: false,
              profile: {
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
              }
            })
          }
        } else {
          setAuthState({
            user: null,
            session: null,
            loading: false,
            profile: null
          })
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('[Auth] State changed:', event, session?.user?.email)

            if (session?.user) {
              try {
                const { db } = await import('@/lib/api')
                const { data: profile } = await db.getProfile(session.user.id)
                setAuthState({
                  user: session.user,
                  session,
                  loading: false,
                  profile: profile || {
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User'
                  }
                })
              } catch {
                setAuthState({
                  user: session.user,
                  session,
                  loading: false,
                  profile: {
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User'
                  }
                })
              }
            } else {
              setAuthState({
                user: null,
                session: null,
                loading: false,
                profile: null
              })
            }
          }
        )

        return () => {
          subscription.unsubscribe()
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        setAuthState({
          user: null,
          session: null,
          loading: false,
          profile: null
        })
      }
    }

    initializeAuth()

    const timeout = setTimeout(() => {
      setAuthState(prev => {
        if (prev.loading) {
          console.warn('Auth loading timeout')
          return { user: null, session: null, loading: false, profile: null }
        }
        return prev
      })
    }, 5000)

    return () => {
      clearTimeout(timeout)
    }
  }, [])

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { authService: auth } = await import('@/lib/api')
    const result = await auth.signUp({ email, password, fullName })

    if (!result.error && result.data) {
      try {
        const { db } = await import('@/lib/api')
        await db.createProfile({
          id: result.data.user.id,
          email: result.data.user.email!,
          full_name: fullName || email.split('@')[0]
        })
      } catch (profileError) {
        console.warn('Profile creation failed (may already exist):', profileError)
      }
    }

    return result
  }

  const signIn = async (email: string, password: string) => {
    const { authService: auth } = await import('@/lib/api')
    const result = await auth.signIn({ email, password })
    return result
  }

  const signOut = async () => {
    const { authService: auth } = await import('@/lib/api')
    const result = await auth.signOut()

    setAuthState({
      user: null,
      session: null,
      loading: false,
      profile: null
    })

    return result
  }

  return {
    ...authState,
    signUp,
    signIn,
    signOut
  }
}