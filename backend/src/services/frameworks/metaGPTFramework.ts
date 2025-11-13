import { AgentFramework, AgentFrameworkMetadata } from '../agentFramework';
import { AgentConfig, AgentResponse } from '../agentService';
import { langchainService } from '../langchainService';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

/**
 * MetaGPT Framework Implementation (Basic Version)
 * 
 * Multi-role agent: Simulates multiple roles working together
 * Best for: Tasks that benefit from different perspectives or expertise
 */
export class MetaGPTFramework implements AgentFramework {
  getMetadata(): AgentFrameworkMetadata {
    return {
      name: 'metagpt',
      displayName: 'MetaGPT',
      description: 'Multi-role agent that simulates a team of specialists working together on complex tasks',
      type: 'multi-role',
      version: '1.0.0',
      capabilities: {
        supportsRecursivePlanning: true,
        supportsMultiRole: true,
        supportsSelfHealing: false,
        supportsCollaboration: true,
        supportsToolUse: true,
        supportsMemory: true,
        maxRoles: 5,
        maxIterations: 15,
        estimatedLatencyMs: 8000,
        costPer1kTokens: 0.08,
      },
      supportedFeatures: [
        'tool-use',
        'memory',
        'multi-role',
        'role-specialization',
        'team-collaboration',
        'complex-tasks',
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
    const model = config.model || (provider === 'openai' ? 'gpt-4' : 'claude-3-opus-20240229');
    const maxIterations = config.maxIterations || 15;
    
    // Define roles (can be customized)
    const roles = this.getRoles(query, config);
    const systemPrompt = config.systemPrompt || 'You are part of a team working together to solve a problem.';

    try {
      // Create multi-role graph
      const graph = this.createMultiRoleGraph(model, provider, systemPrompt, roles, maxIterations);

      // Initial state
      const initialState = {
        goal: query,
        roles,
        currentRoleIndex: 0,
        roleOutputs: {} as Record<string, string>,
        iterations: 0,
        messages: [new HumanMessage(`Team Goal: ${query}`)] as BaseMessage[],
        consensus: null as string | null,
      };

      // Execute role-based collaboration
      const compiledGraph = graph.compile();
      let currentState = initialState;

      while (currentState.iterations < maxIterations && !currentState.consensus) {
        const result = await compiledGraph.invoke(currentState);
        currentState = result as typeof initialState;
        currentState.iterations++;
      }

      const executionTime = Date.now() - startTime;
      const finalOutput = currentState.consensus || this.generateConsensus(currentState);

      return {
        output: finalOutput,
        intermediateSteps: this.extractRoleSteps(currentState),
        executionTime,
      };
    } catch (error: any) {
      throw new Error(`MetaGPT execution failed: ${error.message || error}`);
    }
  }

  private getRoles(query: string, config: AgentConfig): Array<{ name: string; expertise: string; prompt: string }> {
    // Default roles - can be customized
    const defaultRoles = [
      {
        name: 'Analyst',
        expertise: 'Data analysis and research',
        prompt: 'You are an analyst. Analyze the problem, gather information, and provide insights.',
      },
      {
        name: 'Planner',
        expertise: 'Strategic planning',
        prompt: 'You are a planner. Create a structured plan to achieve the goal.',
      },
      {
        name: 'Executor',
        expertise: 'Task execution',
        prompt: 'You are an executor. Implement the plan and execute tasks.',
      },
      {
        name: 'Reviewer',
        expertise: 'Quality assurance',
        prompt: 'You are a reviewer. Review the work and provide feedback.',
      },
    ];

    // Simple role selection based on query
    if (query.toLowerCase().includes('analyze') || query.toLowerCase().includes('research')) {
      return [defaultRoles[0], defaultRoles[1]]; // Analyst + Planner
    }

    if (query.toLowerCase().includes('plan') || query.toLowerCase().includes('strategy')) {
      return [defaultRoles[1], defaultRoles[2]]; // Planner + Executor
    }

    // Default: use all roles
    return defaultRoles.slice(0, 3); // Use first 3 roles
  }

  private createMultiRoleGraph(
    model: string,
    provider: string,
    systemPrompt: string,
    roles: Array<{ name: string; expertise: string; prompt: string }>,
    maxIterations: number
  ): StateGraph<any> {
    const StateAnnotation = Annotation.Root({
      goal: Annotation<string>({
        reducer: (x: string, y: string) => y || x,
        default: () => '',
      }),
      roles: Annotation<Array<{ name: string; expertise: string; prompt: string }>>({
        reducer: (x, y) => y.length > 0 ? y : x,
        default: () => [],
      }),
      currentRoleIndex: Annotation<number>({
        reducer: (x: number, y: number) => y,
        default: () => 0,
      }),
      roleOutputs: Annotation<Record<string, string>>({
        reducer: (x: Record<string, string>, y: Record<string, string>) => ({ ...x, ...y }),
        default: () => ({}),
      }),
      iterations: Annotation<number>({
        reducer: (x: number, y: number) => y,
        default: () => 0,
      }),
      messages: Annotation<BaseMessage[]>({
        reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      }),
      consensus: Annotation<string | null>({
        reducer: (x: string | null, y: string | null) => y || x,
        default: () => null,
      }),
    });

    const graph = new StateGraph(StateAnnotation);

    // Role execution node
    graph.addNode('executeRole', async (state: any) => {
      if (state.currentRoleIndex >= state.roles.length) {
        // All roles have contributed, move to consensus
        return {
          currentRoleIndex: 0, // Reset for consensus
        };
      }

      const currentRole = state.roles[state.currentRoleIndex];
      const previousOutputs = Object.values(state.roleOutputs).join('\n\n');

      const rolePrompt = `${systemPrompt}

${currentRole.prompt}

Goal: ${state.goal}

Previous team member outputs:
${previousOutputs || 'None yet'}

Provide your contribution to achieving this goal:`;

      const response = await langchainService.generateText(rolePrompt, {
        provider: provider as 'openai' | 'anthropic',
        model,
      });

      return {
        roleOutputs: {
          ...state.roleOutputs,
          [currentRole.name]: response.content,
        },
        messages: [...state.messages, new AIMessage(`${currentRole.name}: ${response.content}`)],
        currentRoleIndex: state.currentRoleIndex + 1,
      };
    });

    // Consensus node - combines all role outputs
    graph.addNode('consensus', async (state: any) => {
      const allOutputs = Object.entries(state.roleOutputs)
        .map(([role, output]) => `${role}: ${output}`)
        .join('\n\n');

      const consensusPrompt = `${systemPrompt}

Goal: ${state.goal}

Team Contributions:
${allOutputs}

Synthesize all contributions into a final, comprehensive answer:`;

      const response = await langchainService.generateText(consensusPrompt, {
        provider: provider as 'openai' | 'anthropic',
        model,
      });

      return {
        consensus: response.content,
        messages: [...state.messages, new AIMessage(`Consensus: ${response.content}`)],
      };
    });

    // Add edges
    graph.addEdge(START, 'executeRole');
    graph.addConditionalEdges('executeRole', (state: any) => {
      if (state.currentRoleIndex >= state.roles.length) {
        return 'consensus';
      }
      if (state.iterations >= maxIterations) {
        return END;
      }
      return 'executeRole'; // Continue with next role
    });
    graph.addEdge('consensus', END);

    return graph;
  }

  private extractRoleSteps(state: any): AgentResponse['intermediateSteps'] {
    return Object.entries(state.roleOutputs).map(([role, output]) => ({
      action: {
        tool: 'role',
        toolInput: role,
      },
      observation: output as string,
    }));
  }

  private generateConsensus(state: any): string {
    const outputs = Object.values(state.roleOutputs);
    return `Team Consensus:\n\n${outputs.join('\n\n---\n\n')}`;
  }

  validateConfig(config: AgentConfig): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (config.maxIterations && config.maxIterations < 2) {
      errors.push('MetaGPT requires at least 2 iterations (one per role minimum)');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getRecommendedConfig?(requirements: Record<string, unknown>): Partial<AgentConfig> {
    const recommended: Partial<AgentConfig> = {
      provider: 'openai',
      model: 'gpt-4', // Better for multi-role coordination
      temperature: 0.8, // Higher for diverse perspectives
      maxIterations: 15,
      memoryType: 'buffer',
    };

    if (requirements.many_roles) {
      recommended.maxIterations = 20;
    }

    return recommended;
  }
}

