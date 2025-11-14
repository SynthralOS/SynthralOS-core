/**
 * Cost Calculation Service
 * 
 * Calculates costs for LLM API calls based on provider, model, and token usage.
 * Supports OpenAI, Anthropic, and Google models with up-to-date pricing.
 */

export interface CostCalculationInput {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface CostCalculationResult {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number; // USD
  outputCost: number; // USD
  totalCost: number; // USD
  inputCostPer1k: number; // USD per 1k tokens
  outputCostPer1k: number; // USD per 1k tokens
  ratePer1k: number; // Average rate per 1k tokens in cents (for backward compatibility)
  costUsdCents: number; // Total cost in cents (for backward compatibility)
}

/**
 * Pricing information for LLM models (as of 2024)
 * Prices are per 1M tokens unless otherwise specified
 * 
 * Sources:
 * - OpenAI: https://openai.com/api/pricing/
 * - Anthropic: https://www.anthropic.com/pricing
 * - Google: https://cloud.google.com/vertex-ai/pricing
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI Models (per 1M tokens)
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4-turbo-preview': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-32k': { input: 60.00, output: 120.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-3.5-turbo-16k': { input: 3.00, output: 4.00 },
  'gpt-3.5-turbo-0125': { input: 0.50, output: 1.50 },
  'gpt-3.5-turbo-1106': { input: 1.00, output: 2.00 },
  
  // Anthropic Models (per 1M tokens)
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20240620': { input: 3.00, output: 15.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-2.1': { input: 8.00, output: 24.00 },
  'claude-2.0': { input: 8.00, output: 24.00 },
  'claude-instant-1.2': { input: 0.80, output: 2.40 },
  
  // Google Models (per 1M tokens)
  'gemini-pro': { input: 0.50, output: 1.50 },
  'gemini-pro-vision': { input: 0.25, output: 0.25 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash-8b': { input: 0.0375, output: 0.15 },
  'text-bison': { input: 0.50, output: 0.50 },
  'text-unicorn': { input: 1.00, output: 1.00 },
  
  // Fallback pricing for unknown models (use GPT-3.5 pricing as default)
  'default': { input: 0.50, output: 1.50 },
};

/**
 * Normalize model name to match pricing keys
 */
function normalizeModelName(model: string): string {
  // Remove version suffixes and normalize
  return model
    .toLowerCase()
    .replace(/[-_]/g, '-')
    .trim();
}

/**
 * Get pricing for a specific model
 */
function getModelPricing(provider: string, model: string): { input: number; output: number } {
  const normalizedModel = normalizeModelName(model);
  
  // Try exact match first
  if (MODEL_PRICING[normalizedModel]) {
    return MODEL_PRICING[normalizedModel];
  }
  
  // Try partial match (e.g., "gpt-4" matches "gpt-4-turbo")
  const matchingKey = Object.keys(MODEL_PRICING).find(key => 
    normalizedModel.includes(key) || key.includes(normalizedModel)
  );
  
  if (matchingKey) {
    return MODEL_PRICING[matchingKey];
  }
  
  // Provider-specific fallbacks
  if (provider === 'openai') {
    if (normalizedModel.includes('gpt-4')) {
      return MODEL_PRICING['gpt-4'];
    } else if (normalizedModel.includes('gpt-3.5')) {
      return MODEL_PRICING['gpt-3.5-turbo'];
    }
  } else if (provider === 'anthropic') {
    if (normalizedModel.includes('opus')) {
      return MODEL_PRICING['claude-3-opus'];
    } else if (normalizedModel.includes('sonnet')) {
      return MODEL_PRICING['claude-3-sonnet'];
    } else if (normalizedModel.includes('haiku')) {
      return MODEL_PRICING['claude-3-haiku'];
    }
  } else if (provider === 'google') {
    if (normalizedModel.includes('gemini-1.5-pro')) {
      return MODEL_PRICING['gemini-1.5-pro'];
    } else if (normalizedModel.includes('gemini-1.5-flash')) {
      return MODEL_PRICING['gemini-1.5-flash'];
    } else if (normalizedModel.includes('gemini')) {
      return MODEL_PRICING['gemini-pro'];
    }
  }
  
  // Ultimate fallback
  console.warn(`⚠️ Unknown model pricing for ${provider}/${model}, using default pricing`);
  return MODEL_PRICING['default'];
}

/**
 * Calculate cost for LLM API call
 * 
 * @param input - Cost calculation input with provider, model, and token counts
 * @returns Cost calculation result with detailed breakdown
 */
export function calculateLLMCost(input: CostCalculationInput): CostCalculationResult {
  const { provider, model, inputTokens, outputTokens } = input;
  
  // Get pricing for the model
  const pricing = getModelPricing(provider, model);
  
  // Calculate costs (pricing is per 1M tokens, so divide by 1,000,000)
  const inputCostPer1k = pricing.input / 1000; // USD per 1k tokens
  const outputCostPer1k = pricing.output / 1000; // USD per 1k tokens
  
  const inputCost = (inputTokens / 1000) * inputCostPer1k;
  const outputCost = (outputTokens / 1000) * outputCostPer1k;
  const totalCost = inputCost + outputCost;
  
  const totalTokens = inputTokens + outputTokens;
  
  // Calculate average rate per 1k tokens (for backward compatibility)
  const ratePer1k = totalTokens > 0 
    ? Math.round((totalCost / totalTokens) * 1000 * 100) // in cents
    : 0;
  
  // Convert to cents for backward compatibility
  const costUsdCents = Math.round(totalCost * 100);
  
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    inputCost: Number(inputCost.toFixed(6)), // Round to 6 decimal places
    outputCost: Number(outputCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6)),
    inputCostPer1k: Number(inputCostPer1k.toFixed(6)),
    outputCostPer1k: Number(outputCostPer1k.toFixed(6)),
    ratePer1k,
    costUsdCents,
  };
}

/**
 * Calculate cost from token usage object (from LangChain response)
 */
export function calculateCostFromTokenUsage(
  provider: 'openai' | 'anthropic' | 'google',
  model: string,
  tokenUsage: {
    promptTokens?: number;
    completionTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  }
): CostCalculationResult {
  // Handle different token usage formats
  const inputTokens = tokenUsage.promptTokens || tokenUsage.inputTokens || 0;
  const outputTokens = tokenUsage.completionTokens || tokenUsage.outputTokens || 0;
  
  // If we only have totalTokens, estimate split (rough approximation)
  let finalInputTokens = inputTokens;
  let finalOutputTokens = outputTokens;
  
  if (tokenUsage.totalTokens && inputTokens === 0 && outputTokens === 0) {
    // Estimate 60/40 split (input/output) as a rough approximation
    finalInputTokens = Math.floor(tokenUsage.totalTokens * 0.6);
    finalOutputTokens = tokenUsage.totalTokens - finalInputTokens;
  }
  
  return calculateLLMCost({
    provider,
    model,
    inputTokens: finalInputTokens,
    outputTokens: finalOutputTokens,
  });
}

/**
 * Get pricing information for a model (for display purposes)
 */
export function getModelPricingInfo(
  provider: 'openai' | 'anthropic' | 'google',
  model: string
): { input: number; output: number; inputPer1k: number; outputPer1k: number } {
  const pricing = getModelPricing(provider, model);
  
  return {
    input: pricing.input, // per 1M tokens
    output: pricing.output, // per 1M tokens
    inputPer1k: pricing.input / 1000, // per 1k tokens
    outputPer1k: pricing.output / 1000, // per 1k tokens
  };
}

/**
 * Cost Calculation Service class
 */
export class CostCalculationService {
  /**
   * Calculate cost for LLM call
   */
  calculate(input: CostCalculationInput): CostCalculationResult {
    return calculateLLMCost(input);
  }
  
  /**
   * Calculate cost from token usage
   */
  calculateFromTokenUsage(
    provider: 'openai' | 'anthropic' | 'google',
    model: string,
    tokenUsage: {
      promptTokens?: number;
      completionTokens?: number;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    }
  ): CostCalculationResult {
    return calculateCostFromTokenUsage(provider, model, tokenUsage);
  }
  
  /**
   * Get pricing info for a model
   */
  getPricingInfo(
    provider: 'openai' | 'anthropic' | 'google',
    model: string
  ): { input: number; output: number; inputPer1k: number; outputPer1k: number } {
    return getModelPricingInfo(provider, model);
  }
}

// Export singleton instance
export const costCalculationService = new CostCalculationService();

