import { supabase, isSupabaseConfigured } from './client'
import type { Database } from '@/types/database'

type Tables = Database['public']['Tables']
type Project = Tables['projects']['Row']
type ProjectInsert = Tables['projects']['Insert']
type ProjectUpdate = Tables['projects']['Update']
type Transaction = Tables['transactions']['Row']
type TransactionInsert = Tables['transactions']['Insert']
type TransactionUpdate = Tables['transactions']['Update']
type ChatMessage = Tables['chat_messages']['Row']
type ChatMessageInsert = Tables['chat_messages']['Insert']
type Profile = Tables['profiles']['Row']
type ProfileUpdate = Tables['profiles']['Update']

interface DatabaseResponse<T> {
  data: T | null
  error: Error | null
}

interface DatabaseListResponse<T> {
  data: T[] | null
  error: Error | null
}

class DatabaseService {
  private checkConfig(): Error | null {
    if (!isSupabaseConfigured()) {
      return new Error('Database not configured')
    }
    return null
  }

  async getProjects(): Promise<DatabaseListResponse<Project>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      return { data: data || [], error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to fetch projects')
      }
    }
  }

  async getProject(id: string): Promise<DatabaseResponse<Project>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      return { data, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to fetch project')
      }
    }
  }

  async createProject(project: ProjectInsert): Promise<DatabaseResponse<Project>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert(project as any)
        .select()
        .single()

      return { data, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to create project')
      }
    }
  }

  async updateProject(id: string, updates: ProjectUpdate): Promise<DatabaseResponse<Project>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('projects')
        // @ts-ignore - Supabase type issue when db not configured
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      return { data, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to update project')
      }
    }
  }

  async deleteProject(id: string): Promise<{ error: Error | null }> {
    const configError = this.checkConfig()
    if (configError) return { error: configError }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      return { error }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Failed to delete project')
      }
    }
  }

  async getTransactions(projectId?: string): Promise<DatabaseListResponse<Transaction>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      let query = supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false })

      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error } = await query

      return { data: data || [], error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to fetch transactions')
      }
    }
  }

  async getTransaction(id: string): Promise<DatabaseResponse<Transaction>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      return { data, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to fetch transaction')
      }
    }
  }

  async createTransaction(transaction: TransactionInsert): Promise<DatabaseResponse<Transaction>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert(transaction as any)
        .select()
        .single()

      return { data, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to create transaction')
      }
    }
  }

  async updateTransaction(id: string, updates: TransactionUpdate): Promise<DatabaseResponse<Transaction>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('transactions')
        // @ts-ignore - Supabase type issue when db not configured
        .update(updates as any)
        .eq('id', id)
        .select()
        .single()

      return { data, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to update transaction')
      }
    }
  }

  async deleteTransaction(id: string): Promise<{ error: Error | null }> {
    const configError = this.checkConfig()
    if (configError) return { error: configError }

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)

      return { error }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Failed to delete transaction')
      }
    }
  }

  async getChatMessages(projectId: string): Promise<DatabaseListResponse<ChatMessage>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

      return { data: data || [], error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to fetch chat messages')
      }
    }
  }

  async createChatMessage(message: ChatMessageInsert): Promise<DatabaseResponse<ChatMessage>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(message as any)
        .select()
        .single()

      return { data, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to create chat message')
      }
    }
  }

  async getProfile(userId: string): Promise<DatabaseResponse<Profile>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      return { data, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to fetch profile')
      }
    }
  }

  async createProfile(profile: { id: string; email: string; full_name?: string }): Promise<DatabaseResponse<Profile>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert(profile as any)
        .select()
        .single()

      return { data, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to create profile')
      }
    }
  }

  async updateProfile(userId: string, updates: ProfileUpdate): Promise<DatabaseResponse<Profile>> {
    const configError = this.checkConfig()
    if (configError) return { data: null, error: configError }

    try {
      const { data, error } = await supabase
        .from('profiles')
        // @ts-ignore - Supabase type issue when db not configured
        .update(updates as any)
        .eq('id', userId)
        .select()
        .single()

      return { data, error }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to update profile')
      }
    }
  }

  subscribeToProjects(callback: (payload: any) => void) {
    if (!isSupabaseConfigured()) {
      console.warn('Database not configured, subscriptions disabled')
      return { unsubscribe: () => {} }
    }

    const channel = supabase
      .channel('projects-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        callback
      )
      .subscribe()

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel)
      }
    }
  }

  subscribeToTransactions(projectId: string, callback: (payload: any) => void) {
    if (!isSupabaseConfigured()) {
      console.warn('Database not configured, subscriptions disabled')
      return { unsubscribe: () => {} }
    }

    const channel = supabase
      .channel(`transactions-${projectId}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `project_id=eq.${projectId}`
        },
        callback
      )
      .subscribe()

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel)
      }
    }
  }
}

export const db = new DatabaseService()
export default db
