import { supabase } from '../api/client'
import { GeminiProvider } from './providers/gemini'
import { ClaudeProvider } from './providers/claude'
import type { AIProvider, TransactionAnalysis, APISettings } from './types'

class AIService {
  private providers: Map<string, AIProvider> = new Map()
  private userId: string | null = null

  constructor() {
    this.providers.set('gemini', new GeminiProvider())
    this.providers.set('claude', new ClaudeProvider())
  }

  async initialize(userId: string): Promise<void> {
    this.userId = userId
    console.log('[AI Service] Initializing for user:', userId)

    try {
      const settings = await this.loadAPISettings(userId)

      settings.forEach(setting => {
        if (setting.is_active && setting.api_key) {
          const provider = this.providers.get(setting.provider)
          if (provider) {
            provider.setApiKey(setting.api_key)
            console.log(`[AI Service] ${setting.provider} provider configured (priority: ${setting.priority})`)
          }
        }
      })

      console.log('[AI Service] Initialization complete')
    } catch (error) {
      console.error('[AI Service] Initialization failed:', error)
    }
  }

  private async loadAPISettings(userId: string): Promise<APISettings[]> {
    const { data, error } = await supabase
      .from('api_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) {
      console.error('[AI Service] Failed to load API settings:', error)
      return []
    }

    return data as APISettings[]
  }

  private async getAvailableProviders(): Promise<{ provider: AIProvider; priority: number }[]> {
    if (!this.userId) {
      console.warn('[AI Service] No user ID set')
      return []
    }

    const settings = await this.loadAPISettings(this.userId)

    const available = settings
      .map(setting => {
        const provider = this.providers.get(setting.provider)
        if (provider?.isAvailable()) {
          return { provider, priority: setting.priority }
        }
        return null
      })
      .filter((item): item is { provider: AIProvider; priority: number } => item !== null)
      .sort((a, b) => a.priority - b.priority)

    console.log(`[AI Service] ${available.length} providers available`)
    return available
  }

  async analyzeTransaction(imageData: string): Promise<TransactionAnalysis> {
    const providers = await this.getAvailableProviders()

    if (providers.length === 0) {
      throw new Error('No AI providers configured. Please add your API keys in Settings.')
    }

    let lastError: Error | null = null

    for (const { provider, priority } of providers) {
      try {
        console.log(`[AI Service] Attempting analysis with ${provider.name} (priority: ${priority})`)
        const result = await provider.analyzeTransaction(imageData)
        console.log(`[AI Service] Analysis successful with ${provider.name}`)
        return result
      } catch (error) {
        console.error(`[AI Service] ${provider.name} failed:`, error)
        lastError = error as Error

        if (providers.length > 1) {
          console.log(`[AI Service] Falling back to next provider...`)
        }
      }
    }

    throw lastError || new Error('All AI providers failed')
  }

  async chat(message: string, context?: string): Promise<string> {
    const providers = await this.getAvailableProviders()

    if (providers.length === 0) {
      throw new Error('No AI providers configured. Please add your API keys in Settings.')
    }

    let lastError: Error | null = null

    for (const { provider, priority } of providers) {
      try {
        console.log(`[AI Service] Attempting chat with ${provider.name} (priority: ${priority})`)
        const result = await provider.chat(message, context)
        console.log(`[AI Service] Chat successful with ${provider.name}`)
        return result
      } catch (error) {
        console.error(`[AI Service] ${provider.name} failed:`, error)
        lastError = error as Error

        if (providers.length > 1) {
          console.log(`[AI Service] Falling back to next provider...`)
        }
      }
    }

    throw lastError || new Error('All AI providers failed')
  }

  async saveAPISettings(settings: Omit<APISettings, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
    const { error } = await supabase
      .from('api_settings')
      // @ts-ignore - api_settings table exists but might not be in type definitions
      .upsert(settings as any, {
        onConflict: 'user_id,provider'
      })

    if (error) {
      console.error('[AI Service] Failed to save API settings:', error)
      throw error
    }

    if (settings.is_active && settings.api_key) {
      const provider = this.providers.get(settings.provider)
      if (provider) {
        provider.setApiKey(settings.api_key)
        console.log(`[AI Service] ${settings.provider} provider updated`)
      }
    }
  }

  async getAPISettings(userId: string): Promise<APISettings[]> {
    console.log('[AI Service] Fetching API settings for user:', userId)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const { data, error } = await supabase
        .from('api_settings')
        .select('*')
        .eq('user_id', userId)
        .order('priority', { ascending: true })
        .abortSignal(controller.signal)

      clearTimeout(timeout)

      if (error) {
        console.error('[AI Service] Failed to load API settings:', error)
        return []
      }

      console.log('[AI Service] Loaded API settings:', data)
      return (data as APISettings[]) || []
    } catch (error) {
      console.error('[AI Service] Exception loading API settings:', error)
      return []
    }
  }

  async deleteAPISettings(id: string): Promise<void> {
    const { error } = await supabase
      .from('api_settings')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[AI Service] Failed to delete API settings:', error)
      throw error
    }
  }

  getProviderStatus(): { provider: string; available: boolean }[] {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      provider: name,
      available: provider.isAvailable()
    }))
  }
}

export const aiService = new AIService()
