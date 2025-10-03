import { GoogleGenerativeAI } from '@google/generative-ai'
import { BaseAIProvider } from './base'
import type { TransactionAnalysis } from '../types'
import { TRANSACTION_CATEGORIES } from '../types'

export class GeminiProvider extends BaseAIProvider {
  name = 'gemini'
  private client: GoogleGenerativeAI | null = null
  private model: any = null

  constructor(apiKey?: string) {
    super(apiKey)
    if (this.apiKey) {
      this.initialize()
    }
  }

  private initialize(): void {
    if (!this.apiKey) return

    try {
      this.client = new GoogleGenerativeAI(this.apiKey)
      this.model = this.client.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
      console.log('[Gemini] Provider initialized')
    } catch (error) {
      console.error('[Gemini] Initialization failed:', error)
      this.client = null
      this.model = null
    }
  }

  setApiKey(apiKey: string): void {
    super.setApiKey(apiKey)
    this.initialize()
  }

  isAvailable(): boolean {
    return super.isAvailable() && !!this.model
  }

  async analyzeTransaction(imageData: string): Promise<TransactionAnalysis> {
    if (!this.isAvailable()) {
      throw new Error('Gemini provider not available')
    }

    console.log('[Gemini] Starting transaction analysis')

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
      const imagePart = {
        inlineData: {
          data: imageData.split(',')[1],
          mimeType: 'image/jpeg'
        }
      }

      const result = await this.model.generateContent([prompt, imagePart])
      const response = await result.response
      const text = response.text()

      console.log('[Gemini] Raw response:', text)

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const analysis = JSON.parse(jsonMatch[0])

      const transactionType = analysis.type || 'expense'
      const defaultCategory = transactionType === 'income' ? 'Current Account' : 'Others'

      const normalizedAnalysis: TransactionAnalysis = {
        amount: analysis.amount || 0,
        type: transactionType,
        category: analysis.category || defaultCategory,
        subcategory: analysis.subcategory,
        description: analysis.description || 'Transaction',
        vendorName: analysis.vendorName,
        transactionDate: analysis.transactionDate,
        paymentMethod: analysis.paymentMethod,
        confidence: analysis.confidence || 0.8
      }

      console.log('[Gemini] Analysis complete:', normalizedAnalysis)
      return normalizedAnalysis

    } catch (error) {
      console.error('[Gemini] Analysis failed:', error)
      throw error
    }
  }

  async chat(message: string, context?: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini provider not available')
    }

    console.log('[Gemini] Chat request:', message)

    try {
      const fullPrompt = context
        ? `Context: ${context}\n\nUser: ${message}`
        : message

      const result = await this.model.generateContent(fullPrompt)
      const response = await result.response
      const text = response.text()

      console.log('[Gemini] Chat response:', text)
      return text

    } catch (error) {
      console.error('[Gemini] Chat failed:', error)
      throw error
    }
  }
}
