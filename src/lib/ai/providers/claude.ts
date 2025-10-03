import { BaseAIProvider } from './base'
import type { TransactionAnalysis } from '../types'

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
      "description": string (brief description of what this payment is for),
      "vendorName": string (merchant/vendor name or recipient name),
      "transactionDate": string (date in YYYY-MM-DD format),
      "paymentMethod": string (cash, credit card, debit card, UPI, etc.),
      "confidence": number (0-1, your confidence in this analysis)
    }

    Please analyze the image and extract accurate information. Focus on:
    - The total amount paid/received
    - Whether this is income (money received) or expense (money paid)
    - Who the vendor/recipient is
    - What the payment is for
    - Payment method if visible

    If you cannot determine a field with confidence, omit it or use null.`

    try {
      const base64Data = imageData.split(',')[1]
      const mimeType = imageData.match(/data:([^;]+);/)?.[1] || 'image/jpeg'

      if (!base64Data) {
        throw new Error('Invalid image data: no base64 data found')
      }

      console.log('[Claude] Image data length:', base64Data.length)
      console.log('[Claude] MIME type:', mimeType)

      const requestBody = {
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
      }

      console.log('[Claude] Request body:', JSON.stringify(requestBody, null, 2))

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(requestBody),
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
