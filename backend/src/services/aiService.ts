import { langchainService, LLMConfig, LLMResponse } from './langchainService';

// Keep existing interfaces for backward compatibility
export interface LLMRequest {
  prompt: string;
  config: LLMConfig;
  variables?: Record<string, unknown>;
}

// Re-export types for backward compatibility
export type { LLMConfig, LLMResponse };

/**
 * AI Service - Now uses LangChain under the hood
 * This maintains backward compatibility with existing code while leveraging LangChain
 */
export class AIService {
  /**
   * Generate text - Now uses LangChain under the hood
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    return await langchainService.generateText(
      request.prompt,
      request.config,
      request.variables
    );
  }

  /**
   * Generate embedding - Now uses LangChain under the hood
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return await langchainService.generateEmbedding(text);
  }
}

export const aiService = new AIService();

