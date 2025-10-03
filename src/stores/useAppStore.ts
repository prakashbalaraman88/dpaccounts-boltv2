import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Project, Transaction, ChatMessage } from '@/types'
import { db } from '@/lib/api/database'
import { isValidUUID } from '@/lib/utils'

interface AppState {
  // Projects
  projects: Project[]
  currentProject: Project | null
  
  // Transactions
  transactions: Transaction[]
  
  // Chat
  messages: ChatMessage[]
  isTyping: boolean
  isProcessing: boolean
  pendingTransaction: Partial<Transaction> | null
  
  // Actions
  setProjects: (projects: Project[]) => void
  setCurrentProject: (project: Project | null) => void
  addProject: (project: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  
  setTransactions: (transactions: Transaction[]) => void
  addTransaction: (transaction: Transaction) => void
  updateTransaction: (id: string, updates: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  setIsTyping: (typing: boolean) => void
  setIsProcessing: (processing: boolean) => void
  setPendingTransaction: (transaction: Partial<Transaction> | null) => void
  clearMessages: () => void
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        projects: [],
        currentProject: null,
        transactions: [],
        messages: [],
        isTyping: false,
        isProcessing: false,
        pendingTransaction: null,

        // Project actions
        setProjects: (projects) => set({ projects }),
        setCurrentProject: (project) => set({ currentProject: project }),
        addProject: async (project) => {
          // Try to save to Supabase first
          try {
            const { id, ...projectWithoutId } = project
            const { data, error } = await db.createProject(projectWithoutId)
            if (error || !data) throw error || new Error('No data returned')

            set(state => ({
              projects: [data, ...state.projects]
            }))
            return data
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            if (errorMessage.includes('Database tables not set up')) {
              console.warn('Database not set up. Saving project locally. Please configure your Supabase database.')
            } else {
              console.warn('Failed to save project to Supabase, saving locally:', errorMessage)
            }
            set(state => ({ 
              projects: [project, ...state.projects] 
            }))
            return project
          }
        },
        updateProject: (id, updates) => set(state => ({
          projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p),
          currentProject: state.currentProject?.id === id 
            ? { ...state.currentProject, ...updates }
            : state.currentProject
        })),
        deleteProject: (id) => set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          currentProject: state.currentProject?.id === id ? null : state.currentProject
        })),

        // Transaction actions
        setTransactions: (transactions) => set({ transactions }),
        addTransaction: async (transaction) => {
          let savedToSupabase = false
          
          // Only try to save to Supabase if project_id is a valid UUID
          if (transaction.project_id && isValidUUID(transaction.project_id)) {
            try {
              const { id, ...transactionWithoutId } = transaction
              const { data, error } = await db.createTransaction(transactionWithoutId)
              if (error || !data) throw error || new Error('No data returned')

              set(state => ({
                transactions: [data, ...state.transactions]
              }))
              savedToSupabase = true
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              if (errorMessage.includes('Database tables not set up')) {
                console.warn('Database not set up. Saving transaction locally. Please configure your Supabase database.')
              } else {
                console.warn('Failed to save transaction to Supabase, saving locally:', errorMessage)
              }
            }
          } else {
            console.warn('Invalid project_id UUID, saving transaction locally only')
          }
          
          // Fallback to local storage
          if (!savedToSupabase) {
            set(state => ({
              transactions: [transaction, ...state.transactions]
            }))
          }
        },
        updateTransaction: (id, updates) => set(state => ({
          transactions: state.transactions.map(t => t.id === id ? { ...t, ...updates } : t)
        })),
        deleteTransaction: (id) => set(state => ({
          transactions: state.transactions.filter(t => t.id !== id)
        })),

        // Chat actions
        setMessages: (messages) => set({ messages }),
        addMessage: async (message) => {
          // Try to save to Supabase first
          try {
            const { id, ...messageWithoutId } = message
            const { data, error } = await db.createChatMessage(messageWithoutId)
            if (error || !data) throw error || new Error('No data returned')

            set(state => ({
              messages: [...state.messages, data]
            }))
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            if (errorMessage.includes('Database tables not set up')) {
              console.warn('Database not set up. Saving message locally. Please configure your Supabase database.')
            } else {
              console.warn('Failed to save message to Supabase, saving locally:', errorMessage)
            }
            set(state => ({
              messages: [...state.messages, message]
            }))
          }
        },
        setIsTyping: (typing) => set({ isTyping: typing }),
        setIsProcessing: (processing) => set({ isProcessing: processing }),
        setPendingTransaction: (transaction) => set({ pendingTransaction: transaction }),
        clearMessages: () => set({ messages: [] }),
        
        // Clear all data (for testing persistence)
        clearAllData: () => set({
          projects: [],
          currentProject: null,
          transactions: [],
          messages: []
        }),
      }),
      {
        name: 'interior-accounts-store',
        partialize: (_state) => ({ 
          projects: [],
          currentProject: null,
          transactions: []
        }),
      }
    )
  )
)