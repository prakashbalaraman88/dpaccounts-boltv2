export interface TransactionAnalysis {
  amount: number
  type: 'income' | 'expense'
  category: string
  subcategory?: string
  description: string
  vendorName?: string
  transactionDate?: string
  paymentMethod?: string
  confidence: number
}

export interface AIProvider {
  name: string
  isAvailable(): boolean
  setApiKey(apiKey: string): void
  analyzeTransaction(imageData: string): Promise<TransactionAnalysis>
  chat(message: string, context?: string): Promise<string>
}

export interface APISettings {
  id?: string
  user_id: string
  provider: 'gemini' | 'claude'
  api_key: string
  is_active: boolean
  priority: number
  created_at?: string
  updated_at?: string
}

export type AIProviderType = 'gemini' | 'claude'

export const TRANSACTION_CATEGORIES = {
  income: [
    'Current Account',
    'Savings Account',
    'Cash',
    'Cheque',
    'Others',
  ],
  expense: [
    'Measurements',
    'Designer/Architect',
    'Construction Material',
    'Factory Materials',
    'Onsite Materials',
    'Jobwork',
    'Carpenter',
    'Electrician',
    'False Ceiling',
    'Operational',
    'Others',
  ],
}
