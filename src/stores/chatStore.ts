import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Database } from '@/types/database'
import type { TransactionAnalysis } from '@/lib/ai'

type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
type Transaction = Database['public']['Tables']['transactions']['Row']

interface ChatState {
  messages: ChatMessage[]
  isTyping: boolean
  isProcessing: boolean
  pendingTransaction: Partial<Transaction> | null
  pendingAnalysis: TransactionAnalysis | null
  isChatOpen: boolean

  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  setIsTyping: (typing: boolean) => void
  setIsProcessing: (processing: boolean) => void
  setPendingTransaction: (transaction: Partial<Transaction> | null) => void
  setPendingAnalysis: (analysis: TransactionAnalysis | null) => void
  setIsChatOpen: (open: boolean) => void
  reset: () => void
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set) => ({
      messages: [],
      isTyping: false,
      isProcessing: false,
      pendingTransaction: null,
      pendingAnalysis: null,
      isChatOpen: false,

      setMessages: (messages) => set({ messages }),

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message]
        })),

      clearMessages: () => set({ messages: [], pendingTransaction: null, pendingAnalysis: null }),

      setIsTyping: (typing) => set({ isTyping: typing }),

      setIsProcessing: (processing) => set({ isProcessing: processing }),

      setPendingTransaction: (transaction) => set({ pendingTransaction: transaction }),

      setPendingAnalysis: (analysis) => set({ pendingAnalysis: analysis }),

      setIsChatOpen: (open) => set({ isChatOpen: open }),

      reset: () =>
        set({
          messages: [],
          isTyping: false,
          isProcessing: false,
          pendingTransaction: null,
          pendingAnalysis: null,
          isChatOpen: false
        })
    }),
    { name: 'ChatStore' }
  )
)
