import { BaseAIProvider } from './base'
import type { TransactionAnalysis } from '../types'
import { TRANSACTION_CATEGORIES } from '../types'

export class ClaudeProvider extends BaseAIProvider {
  name = 'claude'
  private readonly apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`

  constructor(apiKey?: string) {
    super(apiKey)
  }

  async analyzeTransaction(imageData: string): Promise<TransactionAnalysis> {
    if (!this.isAvailable()) {
      throw new Error('Claude provider not available')
    }

    console.log('[Claude] Starting transaction analysis')

    const prompt = `Analyze this receipt/transaction image and extract the following information in JSON format:
    {
      "amount": number (total amount),
      "type": "income" or "expense",
      "category": string (from provided categories),
      "subcategory": string (optional),
      "description": string (brief description),
      "vendorName": string (merchant/vendor name),
      "transactionDate": string (date in YYYY-MM-DD format),
      "paymentMethod": string (cash, credit card, debit card, etc.),
      "confidence": number (0-1, your confidence in this analysis)
    }

    Available categories:
    - For income: ${TRANSACTION_CATEGORIES.income.join(', ')}
    - For expense: ${TRANSACTION_CATEGORIES.expense.join(', ')}

    Please analyze the image and provide accurate information. If you cannot determine a field with confidence, use reasonable defaults.`

    try {
      const base64Data = imageData.split(',')[1]
      const mimeType = imageData.match(/data:([^;]+);/)?.[1] || 'image/jpeg'

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mimeType,
                    data: base64Data,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      console.log('[Claude] Raw response:', data)

      const text = data.content[0].text
      const jsonMatch = text.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const analysis = JSON.parse(jsonMatch[0])

      const normalizedAnalysis: TransactionAnalysis = {
        amount: analysis.amount || 0,
        type: analysis.type || 'expense',
        category: analysis.category || 'Other Expense',
        subcategory: analysis.subcategory,
        description: analysis.description || 'Transaction',
        vendorName: analysis.vendorName,
        transactionDate: analysis.transactionDate,
        paymentMethod: analysis.paymentMethod,
        confidence: analysis.confidence || 0.8
      }

      console.log('[Claude] Analysis complete:', normalizedAnalysis)
      return normalizedAnalysis

    } catch (error) {
      console.error('[Claude] Analysis failed:', error)
      throw error
    }
  }

  async chat(message: string, context?: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Claude provider not available')
    }

    console.log('[Claude] Chat request:', message)

    try {
      const fullPrompt = context
        ? `Context: ${context}\n\nUser: ${message}`
        : message

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: fullPrompt,
            },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Claude API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      const text = data.content[0].text

      console.log('[Claude] Chat response:', text)
      return text

    } catch (error) {
      console.error('[Claude] Chat failed:', error)
      throw error
    }
  }
}
