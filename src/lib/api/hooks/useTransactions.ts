import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../database'
import { PROJECTS_QUERY_KEY } from './useProjects'
import type { Database } from '@/types/database'

type Transaction = Database['public']['Tables']['transactions']['Row']
type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
type TransactionUpdate = Database['public']['Tables']['transactions']['Update']

export const TRANSACTIONS_QUERY_KEY = ['transactions']

export function useTransactions(projectId?: string) {
  return useQuery({
    queryKey: projectId ? [...TRANSACTIONS_QUERY_KEY, projectId] : TRANSACTIONS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await db.getTransactions(projectId)
      if (error) throw error
      return data || []
    },
    staleTime: 30000,
    gcTime: 300000
  })
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: [...TRANSACTIONS_QUERY_KEY, 'detail', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await db.getTransaction(id)
      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 30000
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (transaction: TransactionInsert) => {
      const { data, error } = await db.createTransaction(transaction)
      if (error) throw error
      return data
    },
    onSuccess: (newTransaction) => {
      queryClient.setQueryData<Transaction[]>(TRANSACTIONS_QUERY_KEY, (old = []) => {
        return [newTransaction!, ...old]
      })

      if (newTransaction?.project_id) {
        queryClient.setQueryData<Transaction[]>(
          [...TRANSACTIONS_QUERY_KEY, newTransaction.project_id],
          (old = []) => [newTransaction, ...old]
        )
      }

      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
    }
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TransactionUpdate }) => {
      const { data, error } = await db.updateTransaction(id, updates)
      if (error) throw error
      return data
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: TRANSACTIONS_QUERY_KEY })

      const previousTransactions = queryClient.getQueryData<Transaction[]>(TRANSACTIONS_QUERY_KEY)

      queryClient.setQueryData<Transaction[]>(TRANSACTIONS_QUERY_KEY, (old = []) => {
        return old.map(transaction =>
          transaction.id === id ? { ...transaction, ...updates } : transaction
        )
      })

      return { previousTransactions }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(TRANSACTIONS_QUERY_KEY, context.previousTransactions)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
    }
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.deleteTransaction(id)
      if (error) throw error
      return id
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: TRANSACTIONS_QUERY_KEY })

      const previousTransactions = queryClient.getQueryData<Transaction[]>(TRANSACTIONS_QUERY_KEY)

      queryClient.setQueryData<Transaction[]>(TRANSACTIONS_QUERY_KEY, (old = []) => {
        return old.filter(transaction => transaction.id !== id)
      })

      return { previousTransactions }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(TRANSACTIONS_QUERY_KEY, context.previousTransactions)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
    }
  })
}
