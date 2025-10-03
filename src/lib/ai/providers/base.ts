import type { AIProvider, TransactionAnalysis } from '../types'

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string
  protected apiKey: string | null = null

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey
    }
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey !== 'undefined' && this.apiKey !== ''
  }

  abstract analyzeTransaction(imageData: string): Promise<TransactionAnalysis>
  abstract chat(message: string, context?: string): Promise<string>

  protected parseAmount(text: string): number {
    const match = text.match(/[\d,]+\.?\d*/);
    if (match) {
      return parseFloat(match[0].replace(/,/g, ''));
    }
    return 0;
  }

  protected parseDate(text: string): string | undefined {
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
      /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return undefined;
  }
}
