interface Project {
  id: string
  name: string
  client_name: string
  client_contact?: string | null
  client_email?: string | null
  budget?: number | null
  spent?: number | null
  status: 'active' | 'completed' | 'on_hold' | 'cancelled'
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  created_at: string
  updated_at: string
  user_id: string
}

interface Transaction {
  id: string
  project_id: string
  amount: number
  type: 'income' | 'expense'
  category: string
  subcategory?: string | null
  description?: string | null
  receipt_url?: string | null
  payment_method?: string | null
  vendor_name?: string | null
  transaction_date: string
  is_verified: boolean
  notes?: string | null
  created_at: string
  updated_at: string
  user_id: string
}

interface ChatMessage {
  id: string
  project_id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  message_type: 'text' | 'image' | 'transaction' | 'followup'
  image_url?: string | null
  transaction_id?: string | null
  ai_analysis?: any | null
  created_at: string
  user_id: string
}

interface TransactionCategory {
  id: string
  name: string
  type: 'income' | 'expense'
  subcategories: string[]
  is_default: boolean
  user_id?: string | null
}

export type { Project, Transaction, ChatMessage, TransactionCategory }