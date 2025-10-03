import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthContext } from '@/components/auth/AuthProvider'

export const useSupabaseData = () => {
  const { user } = useAuthContext()
  const { 
    setProjects, 
    setTransactions, 
    setMessages, 
    currentProject 
  } = useAppStore()

  // Load projects
  useEffect(() => {
    if (!user) return

    const loadProjects = async () => {
      try {
        // Dynamic import to handle cases where Supabase might not be available
        const { db } = await import('@/lib/api')
        const { data, error } = await db.getProjects()
        
        if (error) {
          console.warn('Failed to load projects from Supabase:', error.message || error)
          return
        }
        
        if (data && Array.isArray(data)) {
          setProjects(data)
        }
      } catch (error) {
        // Silently handle all errors - app will work with local storage
        console.warn('Supabase projects loading failed, using local storage')
      }
    }

    // Don't let this fail the entire app
    loadProjects().catch(() => {
      // Silent catch - already handled above
    })
  }, [user, setProjects])

  // Load transactions
  useEffect(() => {
    if (!user) return

    const loadTransactions = async () => {
      try {
        const { db } = await import('@/lib/api')
        const { data, error } = await db.getTransactions()
        
        if (error) {
          console.warn('Failed to load transactions from Supabase:', error.message || error)
          return
        }
        
        if (data && Array.isArray(data)) {
          setTransactions(data)
        }
      } catch (error) {
        console.warn('Supabase transactions loading failed, using local storage')
      }
    }

    loadTransactions().catch(() => {
      // Silent catch
    })
  }, [user, setTransactions])

  // Load chat messages for current project - only if it has a valid UUID
  useEffect(() => {
    if (!user || !currentProject) return

    // Only try to load messages if the project ID looks like a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(currentProject.id)) {
      // For non-UUID projects (local storage), clear messages
      setMessages([])
      return
    }

    const loadMessages = async () => {
      try {
        const { db } = await import('@/lib/api')
        const { data, error } = await db.getChatMessages(currentProject.id)
        
        if (error) {
          console.warn('Failed to load messages from Supabase:', error.message || error)
          return
        }
        
        if (data && Array.isArray(data)) {
          setMessages(data)
        }
      } catch (error) {
        console.warn('Supabase messages loading failed, using local storage')
      }
    }

    loadMessages().catch(() => {
      // Silent catch
    })
  }, [user, currentProject, setMessages])
}