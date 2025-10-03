import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function parseAmount(text: string): number | null {
  const lakhPattern = /(\d+(?:\.\d+)?)\s*lakhs?/i
  const crorePattern = /(\d+(?:\.\d+)?)\s*crores?/i
  const numberPattern = /(\d+(?:,\d+)*(?:\.\d+)?)/

  if (lakhPattern.test(text)) {
    const match = text.match(lakhPattern)
    return match ? parseFloat(match[1]) * 100000 : null
  }

  if (crorePattern.test(text)) {
    const match = text.match(crorePattern)
    return match ? parseFloat(match[1]) * 10000000 : null
  }

  if (numberPattern.test(text)) {
    const match = text.match(numberPattern)
    return match ? parseFloat(match[1].replace(/,/g, '')) : null
  }

  return null
}

export function getTransactionType(text: string): 'income' | 'expense' | null {
  const incomeKeywords = ['received', 'payment', 'advance', 'income', 'credit']
  const expenseKeywords = ['paid', 'expense', 'cost', 'purchase', 'debit', 'spent']

  const lowerText = text.toLowerCase()

  if (incomeKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'income'
  }

  if (expenseKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'expense'
  }

  return null
}

// Helper function to check if a string is a valid UUID
export const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}