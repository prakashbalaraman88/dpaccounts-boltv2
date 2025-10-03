export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          company_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          company_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          company_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          client_name: string
          client_contact: string | null
          client_email: string | null
          budget: number | null
          spent: number | null
          status: 'active' | 'completed' | 'on_hold' | 'cancelled'
          description: string | null
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          client_name: string
          client_contact?: string | null
          client_email?: string | null
          budget?: number | null
          spent?: number | null
          status?: 'active' | 'completed' | 'on_hold' | 'cancelled'
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          client_name?: string
          client_contact?: string | null
          client_email?: string | null
          budget?: number | null
          spent?: number | null
          status?: 'active' | 'completed' | 'on_hold' | 'cancelled'
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
      }
      transactions: {
        Row: {
          id: string
          project_id: string
          amount: number
          type: 'income' | 'expense'
          category: string
          subcategory: string | null
          description: string | null
          receipt_url: string | null
          payment_method: string | null
          vendor_name: string | null
          transaction_date: string
          is_verified: boolean
          notes: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          project_id: string
          amount: number
          type: 'income' | 'expense'
          category: string
          subcategory?: string | null
          description?: string | null
          receipt_url?: string | null
          payment_method?: string | null
          vendor_name?: string | null
          transaction_date?: string
          is_verified?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          project_id?: string
          amount?: number
          type?: 'income' | 'expense'
          category?: string
          subcategory?: string | null
          description?: string | null
          receipt_url?: string | null
          payment_method?: string | null
          vendor_name?: string | null
          transaction_date?: string
          is_verified?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          project_id: string
          content: string
          role: 'user' | 'assistant' | 'system'
          message_type: 'text' | 'image' | 'transaction' | 'followup'
          image_url: string | null
          transaction_id: string | null
          ai_analysis: Json | null
          created_at: string
          user_id: string
        }
        Insert: {
          id?: string
          project_id: string
          content: string
          role: 'user' | 'assistant' | 'system'
          message_type?: 'text' | 'image' | 'transaction' | 'followup'
          image_url?: string | null
          transaction_id?: string | null
          ai_analysis?: Json | null
          created_at?: string
          user_id: string
        }
        Update: {
          id?: string
          project_id?: string
          content?: string
          role?: 'user' | 'assistant' | 'system'
          message_type?: 'text' | 'image' | 'transaction' | 'followup'
          image_url?: string | null
          transaction_id?: string | null
          ai_analysis?: Json | null
          created_at?: string
          user_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}