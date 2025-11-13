import { AgentFramework, AgentFrameworkMetadata } from '../agentFramework';
import { AgentConfig, AgentResponse } from '../agentService';
import { agentService } from '../agentService';

/**
 * ReAct Framework Implementation
 * 
 * Implements the ReAct (Reasoning + Acting) agent framework
 * This is our current implementation, now wrapped as a framework
 */
export class ReActFramework implements AgentFramework {
  getMetadata(): AgentFrameworkMetadata {
    return {
      name: 'react',
      displayName: 'ReAct Agent',
      description: 'Reasoning and Acting agent that autonomously uses tools to answer questions and complete tasks',
      type: 'react',
      version: '1.0.0',
      capabilities: {
        supportsRecursivePlanning: true,
        supportsMultiRole: false,
        supportsSelfHealing: false,
        supportsCollaboration: false,
        supportsToolUse: true,
        supportsMemory: true,
        maxIterations: 15,
        estimatedLatencyMs: 2000,
        costPer1kTokens: 0.03,
      },
      supportedFeatures: [
        'tool-use',
        'memory',
        'recursive-planning',
        'multi-step-tasks',
        'autonomous-decision-making',
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
    // Use the existing agent service
    const agentId = `react_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Ensure type is set to react
    const reactConfig: AgentConfig = {
      ...config,
      type: 'react',
    };

    // Create agent
    await agentService.createAgent(agentId, reactConfig);

    try {
      // Execute agent
      const result = await agentService.executeAgent(agentId, query, context);
      
      // Cleanup
      agentService.deleteAgent(agentId);
      
      return result;
    } catch (error: any) {
      // Cleanup on error
      agentService.deleteAgent(agentId);
      throw error;
    }
  }

  async *stream(
    query: string,
    config: AgentConfig,
    context?: Record<string, unknown>
  ): AsyncGenerator<Partial<AgentResponse>, void, unknown> {
    const agentId = `react_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const reactConfig: AgentConfig = {
      ...config,
      type: 'react',
    };

    await agentService.createAgent(agentId, reactConfig);

    try {
      for await (const chunk of agentService.streamAgent(agentId, query, context)) {
        yield chunk;
      }
    } finally {
      agentService.deleteAgent(agentId);
    }
  }

  validateConfig(config: AgentConfig): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (config.maxIterations && config.maxIterations < 1) {
      errors.push('maxIterations must be at least 1');
    }

    if (config.maxIterations && config.maxIterations > 50) {
      errors.push('maxIterations should not exceed 50 for ReAct agents');
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('temperature must be between 0 and 2');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getRequiredTools?(): string[] {
    // ReAct doesn't require specific tools, but works best with:
    return ['calculator', 'wikipedia', 'duckduckgo_search'];
  }

  getRecommendedConfig?(requirements: Record<string, unknown>): Partial<AgentConfig> {
    const recommended: Partial<AgentConfig> = {
      type: 'react',
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxIterations: 15,
      returnIntermediateSteps: true,
      memoryType: 'buffer',
    };

    // Adjust based on requirements
    if (requirements.complex_task) {
      recommended.maxIterations = 25;
    }

    if (requirements.fast_response) {
      recommended.model = 'gpt-3.5-turbo';
      recommended.maxIterations = 10;
    }

    if (requirements.long_memory) {
      recommended.memoryType = 'summary';
      recommended.memoryMaxTokenLimit = 4000;
    }

    return recommended;
  }
}

