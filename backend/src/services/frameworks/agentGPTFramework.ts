import { AgentFramework, AgentFrameworkMetadata } from '../agentFramework';
import { AgentConfig, AgentResponse } from '../agentService';
import { langchainService } from '../langchainService';

/**
 * AgentGPT Framework Implementation
 * 
 * One-shot agent: Simple prompt → task execution
 * Best for: Simple, straightforward tasks that don't require planning
 */
export class AgentGPTFramework implements AgentFramework {
  getMetadata(): AgentFrameworkMetadata {
    return {
      name: 'agentgpt',
      displayName: 'AgentGPT',
      description: 'One-shot agent for simple, straightforward tasks. Executes tasks directly without complex planning.',
      type: 'one-shot',
      version: '1.0.0',
      capabilities: {
        supportsRecursivePlanning: false,
        supportsMultiRole: false,
        supportsSelfHealing: false,
        supportsCollaboration: false,
        supportsToolUse: true,
        supportsMemory: true,
        maxIterations: 5,
        estimatedLatencyMs: 1000,
        costPer1kTokens: 0.02,
      },
      supportedFeatures: [
        'tool-use',
        'memory',
        'simple-tasks',
        'direct-execution',
      ],
    };
  }

  supportsFeature(feature: string): boolean {
    const supported = this.getMetadata().supportedFeatures;
    return supported.includes(feature);
  }

  async execute(
    query: string,
    config: AgentConfig,
    context?: Record<string, unknown>
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    const provider = config.provider || 'openai';
    const model = config.model || (provider === 'openai' ? 'gpt-3.5-turbo' : 'claude-3-haiku-20240307');
    const systemPrompt = config.systemPrompt || 'You are a helpful assistant. Answer questions directly and concisely.';

    try {
      // Simple one-shot execution - no planning, just direct response
      const response = await langchainService.generateText(
        query,
        {
          provider: provider as 'openai' | 'anthropic',
          model,
          systemPrompt,
          temperature: config.temperature || 0.7,
          maxTokens: config.maxIterations ? config.maxIterations * 100 : 500,
        }
      );

      const executionTime = Date.now() - startTime;

      return {
        output: response.content,
        executionTime,
        tokensUsed: response.tokensUsed,
        cost: response.cost,
      };
    } catch (error: any) {
      throw new Error(`AgentGPT execution failed: ${error.message || error}`);
    }
  }

  validateConfig(config: AgentConfig): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (config.maxIterations && config.maxIterations > 10) {
      errors.push('AgentGPT works best with maxIterations <= 10 (one-shot agent)');
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('temperature must be between 0 and 2');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getRecommendedConfig?(requirements: Record<string, unknown>): Partial<AgentConfig> {
    const recommended: Partial<AgentConfig> = {
      provider: 'openai',
      model: 'gpt-3.5-turbo', // Faster and cheaper for simple tasks
      temperature: 0.7,
      maxIterations: 1, // One-shot
      memoryType: 'buffer',
    };

    // Adjust based on requirements
    if (requirements.fast_response) {
      recommended.model = 'gpt-3.5-turbo';
    }

    if (requirements.high_quality) {
      recommended.model = 'gpt-4';
    }

    return recommended;
  }
}

