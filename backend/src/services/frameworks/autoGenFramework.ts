import { AgentFramework, AgentFrameworkMetadata } from '../agentFramework';
import { AgentConfig, AgentResponse } from '../agentService';
import { langchainService } from '../langchainService';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { langtoolsService } from '../langtoolsService';
import { Tool } from '@langchain/core/tools';

/**
 * AutoGen Framework Implementation (Basic Version)
 * 
 * Collaborative agent: Multiple agents with different capabilities working together
 * Best for: Complex tasks requiring different skills and tool usage
 */
export class AutoGenFramework implements AgentFramework {
  getMetadata(): AgentFrameworkMetadata {
    return {
      name: 'autogen',
      displayName: 'AutoGen',
      description: 'Collaborative multi-agent system where agents with different capabilities work together',
      type: 'collaborative',
      version: '1.0.0',
      capabilities: {
        supportsRecursivePlanning: true,
        supportsMultiRole: true,
        supportsSelfHealing: false,
        supportsCollaboration: true,
        supportsToolUse: true,
        supportsMemory: true,
        maxRoles: 3,
        maxIterations: 20,
        estimatedLatencyMs: 10000,
        costPer1kTokens: 0.10,
      },
      supportedFeatures: [
        'tool-use',
        'memory',
        'multi-agent',
        'agent-collaboration',
        'tool-specialization',
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
    const maxIterations = config.maxIterations || 20;
    const tools = this.getTools(config.tools || []);

    // Define agents with different capabilities
    const agents = this.getAgents(query, tools);
    const systemPrompt = config.systemPrompt || 'You are part of a collaborative agent team. Work together to solve the problem.';

    try {
      // Create collaborative graph
      const graph = this.createCollaborativeGraph(model, provider, systemPrompt, agents, tools, maxIterations);

      // Initial state
      const initialState = {
        goal: query,
        agents,
        currentAgentIndex: 0,
        agentOutputs: {} as Record<string, string>,
        sharedContext: {} as Record<string, unknown>,
        iterations: 0,
        messages: [new HumanMessage(`Team Goal: ${query}`)] as BaseMessage[],
        finalAnswer: null as string | null,
      };

      // Execute collaborative workflow
      const compiledGraph = graph.compile();
      let currentState = initialState;

      while (currentState.iterations < maxIterations && !currentState.finalAnswer) {
        const result = await compiledGraph.invoke(currentState);
        currentState = result as typeof initialState;
        currentState.iterations++;
      }

      const executionTime = Date.now() - startTime;
      const finalOutput = currentState.finalAnswer || this.generateFinalAnswer(currentState);

      return {
        output: finalOutput,
        intermediateSteps: this.extractAgentSteps(currentState),
        executionTime,
      };
    } catch (error: any) {
      throw new Error(`AutoGen execution failed: ${error.message || error}`);
    }
  }

  private getAgents(query: string, tools: Tool[]): Array<{ name: string; role: string; tools: string[]; prompt: string }> {
    // Define agents based on available tools and query
    const agents = [
      {
        name: 'Researcher',
        role: 'Research and information gathering',
        tools: tools.filter(t => t.name.includes('search') || t.name.includes('wikipedia')).map(t => t.name),
        prompt: 'You are a researcher. Use available tools to gather information and research the topic.',
      },
      {
        name: 'Analyst',
        role: 'Data analysis and computation',
        tools: tools.filter(t => t.name.includes('calculator') || t.name.includes('compute')).map(t => t.name),
        prompt: 'You are an analyst. Analyze data, perform calculations, and provide insights.',
      },
      {
        name: 'Coordinator',
        role: 'Task coordination and synthesis',
        tools: [],
        prompt: 'You are a coordinator. Synthesize information from other agents and provide the final answer.',
      },
    ];

    // Filter agents that have relevant tools or are always needed (coordinator)
    return agents.filter(agent => agent.tools.length > 0 || agent.name === 'Coordinator');
  }

  private createCollaborativeGraph(
    model: string,
    provider: string,
    systemPrompt: string,
    agents: Array<{ name: string; role: string; tools: string[]; prompt: string }>,
    tools: Tool[],
    maxIterations: number
  ): StateGraph<any> {
    const StateAnnotation = Annotation.Root({
      goal: Annotation<string>({
        reducer: (x: string, y: string) => y || x,
        default: () => '',
      }),
      agents: Annotation<Array<{ name: string; role: string; tools: string[]; prompt: string }>>({
        reducer: (x, y) => y.length > 0 ? y : x,
        default: () => [],
      }),
      currentAgentIndex: Annotation<number>({
        reducer: (x: number, y: number) => y,
        default: () => 0,
      }),
      agentOutputs: Annotation<Record<string, string>>({
        reducer: (x: Record<string, string>, y: Record<string, string>) => ({ ...x, ...y }),
        default: () => ({}),
      }),
      sharedContext: Annotation<Record<string, unknown>>({
        reducer: (x: Record<string, unknown>, y: Record<string, unknown>) => ({ ...x, ...y }),
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
      finalAnswer: Annotation<string | null>({
        reducer: (x: string | null, y: string | null) => y || x,
        default: () => null,
      }),
    });

    const graph = new StateGraph(StateAnnotation);

    // Agent execution node
    graph.addNode('executeAgent', async (state: any) => {
      if (state.currentAgentIndex >= state.agents.length) {
        // All agents have contributed, move to coordinator
        const coordinator = state.agents.find((a: any) => a.name === 'Coordinator');
        if (coordinator) {
          return {
            currentAgentIndex: state.agents.indexOf(coordinator),
          };
        }
        // No coordinator, generate final answer
        return {
          finalAnswer: this.generateFinalAnswer(state),
        };
      }

      const currentAgent = state.agents[state.currentAgentIndex];
      const previousOutputs = Object.entries(state.agentOutputs)
        .map(([name, output]) => `${name}: ${output}`)
        .join('\n\n');

      const agentPrompt = `${systemPrompt}

${currentAgent.prompt}

Goal: ${state.goal}

Shared Context: ${JSON.stringify(state.sharedContext, null, 2)}

Previous agent outputs:
${previousOutputs || 'None yet'}

Available tools: ${currentAgent.tools.join(', ')}

Provide your contribution. If you need to use tools, specify which tool and input:`;

      const response = await langchainService.generateText(agentPrompt, {
        provider: provider as 'openai' | 'anthropic',
        model,
      });

      // Try to execute tools if mentioned
      let result = response.content;
      const toolResult = await this.tryExecuteTools(response.content, currentAgent.tools, tools);
      if (toolResult) {
        result = toolResult;
        // Update shared context
        state.sharedContext[`${currentAgent.name}_tool_result`] = toolResult;
      }

      return {
        agentOutputs: {
          ...state.agentOutputs,
          [currentAgent.name]: result,
        },
        messages: [...state.messages, new AIMessage(`${currentAgent.name}: ${result}`)],
        currentAgentIndex: state.currentAgentIndex + 1,
        sharedContext: state.sharedContext,
      };
    });

    // Coordinator node
    graph.addNode('coordinate', async (state: any) => {
      const allOutputs = Object.entries(state.agentOutputs)
        .map(([agent, output]) => `${agent}: ${output}`)
        .join('\n\n');

      const coordinationPrompt = `${systemPrompt}

Goal: ${state.goal}

Agent Contributions:
${allOutputs}

Synthesize all contributions into a comprehensive final answer:`;

      const response = await langchainService.generateText(coordinationPrompt, {
        provider: provider as 'openai' | 'anthropic',
        model,
      });

      return {
        finalAnswer: response.content,
        messages: [...state.messages, new AIMessage(`Final Answer: ${response.content}`)],
      };
    });

    // Add edges
    graph.addEdge(START, 'executeAgent');
    graph.addConditionalEdges('executeAgent', (state: any) => {
      if (state.finalAnswer) {
        return END;
      }
      if (state.currentAgentIndex >= state.agents.length) {
        const coordinator = state.agents.find((a: any) => a.name === 'Coordinator');
        return coordinator ? 'coordinate' : END;
      }
      if (state.iterations >= maxIterations) {
        return END;
      }
      return 'executeAgent';
    });
    graph.addEdge('coordinate', END);

    return graph;
  }

  private async tryExecuteTools(
    response: string,
    availableToolNames: string[],
    allTools: Tool[]
  ): Promise<string | null> {
    for (const toolName of availableToolNames) {
      if (response.toLowerCase().includes(toolName.toLowerCase())) {
        const tool = allTools.find(t => t.name === toolName);
        if (tool) {
          try {
            // Extract input (simplified)
            const inputMatch = response.match(new RegExp(`${toolName}[\\s:]+(.+?)(?:\n|$)`, 'i'));
            if (inputMatch) {
              const result = await tool.invoke(inputMatch[1].trim());
              return `Tool ${toolName} executed: ${result}`;
            }
          } catch (error) {
            // Tool execution failed
          }
        }
      }
    }
    return null;
  }

  private extractAgentSteps(state: any): AgentResponse['intermediateSteps'] {
    return Object.entries(state.agentOutputs).map(([agent, output]) => ({
      action: {
        tool: 'agent',
        toolInput: agent,
      },
      observation: output as string,
    }));
  }

  private generateFinalAnswer(state: any): string {
    const outputs = Object.values(state.agentOutputs);
    return `Collaborative Answer:\n\n${outputs.join('\n\n---\n\n')}`;
  }

  private getTools(toolNames: string[]): Tool[] {
    const allTools = langtoolsService.getAllToolsMap();
    
    if (toolNames.length === 0) {
      return Array.from(allTools.values()) as Tool[];
    }
    
    return toolNames
      .map(name => allTools.get(name))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  validateConfig(config: AgentConfig): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (config.maxIterations && config.maxIterations < 3) {
      errors.push('AutoGen requires at least 3 iterations for collaboration');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getRecommendedConfig?(requirements: Record<string, unknown>): Partial<AgentConfig> {
    const recommended: Partial<AgentConfig> = {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxIterations: 20,
      memoryType: 'buffer',
    };

    if (requirements.complex_collaboration) {
      recommended.maxIterations = 30;
    }

    return recommended;
  }
}

