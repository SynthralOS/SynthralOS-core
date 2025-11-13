import { AgentFramework, AgentFrameworkMetadata } from '../agentFramework';
import { AgentConfig, AgentResponse } from '../agentService';
import { langchainService } from '../langchainService';
import { langtoolsService } from '../langtoolsService';
import { Tool } from '@langchain/core/tools';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

/**
 * AutoGPT Framework Implementation
 * 
 * Recursive planning agent: Goal decomposition and iterative execution
 * Best for: Complex tasks that require breaking down into sub-tasks
 */
export class AutoGPTFramework implements AgentFramework {
  getMetadata(): AgentFrameworkMetadata {
    return {
      name: 'autogpt',
      displayName: 'AutoGPT',
      description: 'Recursive planning agent that breaks down complex goals into sub-tasks and executes them iteratively',
      type: 'recursive',
      version: '1.0.0',
      capabilities: {
        supportsRecursivePlanning: true,
        supportsMultiRole: false,
        supportsSelfHealing: false,
        supportsCollaboration: false,
        supportsToolUse: true,
        supportsMemory: true,
        maxIterations: 20,
        estimatedLatencyMs: 5000,
        costPer1kTokens: 0.05,
      },
      supportedFeatures: [
        'tool-use',
        'memory',
        'recursive-planning',
        'goal-decomposition',
        'iterative-execution',
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
    const systemPrompt = config.systemPrompt || `You are an autonomous agent that breaks down complex goals into sub-tasks.
Your process:
1. Analyze the goal
2. Break it down into smaller, actionable sub-tasks
3. Execute each sub-task
4. Use results to inform next steps
5. Continue until goal is achieved

Always think step by step and explain your reasoning.`;

    // Get available tools
    const tools = this.getTools(config.tools || []);

    try {
      // Create planning graph
      const graph = this.createPlanningGraph(model, provider, systemPrompt, tools, maxIterations);

      // Initial state
      const initialState = {
        goal: query,
        tasks: [] as string[],
        completedTasks: [] as string[],
        currentTask: null as string | null,
        results: {} as Record<string, string>,
        iterations: 0,
        messages: [new HumanMessage(`Goal: ${query}`)] as BaseMessage[],
      };

      // Execute planning loop
      const compiledGraph = graph.compile();
      let currentState = initialState;
      let finalOutput = '';

      while (currentState.iterations < maxIterations && currentState.currentTask !== 'COMPLETE') {
        const result = await compiledGraph.invoke(currentState);
        currentState = result as typeof initialState;

        if (currentState.currentTask === 'COMPLETE') {
          // Goal achieved
          finalOutput = this.generateFinalOutput(currentState);
          break;
        }

        currentState.iterations++;
      }

      const executionTime = Date.now() - startTime;

      return {
        output: finalOutput || currentState.results[Object.keys(currentState.results).pop() || ''] || 'Task execution completed',
        intermediateSteps: this.extractIntermediateSteps(currentState),
        executionTime,
      };
    } catch (error: any) {
      throw new Error(`AutoGPT execution failed: ${error.message || error}`);
    }
  }

  private createPlanningGraph(
    model: string,
    provider: string,
    systemPrompt: string,
    tools: Tool[],
    maxIterations: number
  ): StateGraph<any> {
    const StateAnnotation = Annotation.Root({
      goal: Annotation<string>({
        reducer: (x: string, y: string) => y || x,
        default: () => '',
      }),
      tasks: Annotation<string[]>({
        reducer: (x: string[], y: string[]) => y.length > 0 ? y : x,
        default: () => [],
      }),
      completedTasks: Annotation<string[]>({
        reducer: (x: string[], y: string[]) => [...x, ...y],
        default: () => [],
      }),
      currentTask: Annotation<string | null>({
        reducer: (x: string | null, y: string | null) => y || x,
        default: () => null,
      }),
      results: Annotation<Record<string, string>>({
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
    });

    const graph = new StateGraph(StateAnnotation);

    // Planning node - breaks down goal into tasks
    graph.addNode('plan', async (state: any) => {
      if (state.tasks.length === 0) {
        // Initial planning
        const planningPrompt = `${systemPrompt}

Goal: ${state.goal}

Break down this goal into 3-5 specific, actionable sub-tasks. List them as:
1. Task 1
2. Task 2
...`;

        const response = await langchainService.generateText(planningPrompt, {
          provider: provider as 'openai' | 'anthropic',
          model,
        });

        // Parse tasks from response
        const tasks = this.parseTasks(response.content);
        
        return {
          tasks,
          currentTask: tasks[0] || null,
          messages: [...state.messages, new AIMessage(response.content)],
        };
      } else {
        // Check if all tasks completed
        if (state.completedTasks.length >= state.tasks.length) {
          return {
            currentTask: 'COMPLETE',
          };
        }

        // Get next task
        const nextTask = state.tasks.find((t: string) => !state.completedTasks.includes(t));
        return {
          currentTask: nextTask || 'COMPLETE',
        };
      }
    });

    // Execution node - executes current task
    graph.addNode('execute', async (state: any) => {
      if (!state.currentTask || state.currentTask === 'COMPLETE') {
        return state;
      }

      const executionPrompt = `${systemPrompt}

Current Task: ${state.currentTask}
Goal: ${state.goal}
Completed Tasks: ${state.completedTasks.join(', ')}

Execute this task. If you need to use tools, specify which tool and what input.`;

      const response = await langchainService.generateText(executionPrompt, {
        provider: provider as 'openai' | 'anthropic',
        model,
      });

      // Try to execute tools if mentioned
      let result = response.content;
      const toolResult = await this.tryExecuteTools(response.content, tools);
      if (toolResult) {
        result = toolResult;
      }

      return {
        completedTasks: [...state.completedTasks, state.currentTask],
        results: {
          ...state.results,
          [state.currentTask]: result,
        },
        messages: [...state.messages, new AIMessage(result)],
      };
    });

    // Add edges
    graph.addEdge(START, 'plan');
    graph.addConditionalEdges('plan', (state: any) => {
      return state.currentTask === 'COMPLETE' ? END : 'execute';
    });
    graph.addConditionalEdges('execute', (state: any) => {
      return state.iterations >= maxIterations || state.currentTask === 'COMPLETE' ? END : 'plan';
    });

    return graph;
  }

  private parseTasks(planningResponse: string): string[] {
    const lines = planningResponse.split('\n');
    const tasks: string[] = [];

    for (const line of lines) {
      const match = line.match(/^\d+[\.\)]\s*(.+)$/);
      if (match) {
        tasks.push(match[1].trim());
      }
    }

    return tasks.length > 0 ? tasks : [planningResponse];
  }

  private async tryExecuteTools(response: string, tools: Tool[]): Promise<string | null> {
    // Simple tool detection - look for tool names in response
    for (const tool of tools) {
      if (response.toLowerCase().includes(tool.name.toLowerCase())) {
        try {
          // Extract input (simplified - in production, use proper parsing)
          const inputMatch = response.match(new RegExp(`${tool.name}[\\s:]+(.+?)(?:\n|$)`, 'i'));
          if (inputMatch) {
            const result = await tool.invoke(inputMatch[1].trim());
            return `Tool ${tool.name} executed: ${result}`;
          }
        } catch (error) {
          // Tool execution failed, continue
        }
      }
    }
    return null;
  }

  private extractIntermediateSteps(state: any): AgentResponse['intermediateSteps'] {
    return state.tasks.map((task: string, index: number) => ({
      action: {
        tool: 'planning',
        toolInput: task,
      },
      observation: state.results[task] || 'Not executed',
    }));
  }

  private generateFinalOutput(state: any): string {
    const summary = `Goal: ${state.goal}

Completed Tasks:
${state.completedTasks.map((task: string, i: number) => `${i + 1}. ${task}: ${state.results[task] || 'Completed'}`).join('\n')}

Goal achieved!`;
    return summary;
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
      errors.push('AutoGPT requires at least 3 iterations for planning');
    }

    if (config.maxIterations && config.maxIterations > 50) {
      errors.push('AutoGPT maxIterations should not exceed 50');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  getRecommendedConfig?(requirements: Record<string, unknown>): Partial<AgentConfig> {
    const recommended: Partial<AgentConfig> = {
      provider: 'openai',
      model: 'gpt-4', // Better for planning
      temperature: 0.7,
      maxIterations: 20,
      memoryType: 'buffer',
    };

    if (requirements.complex_task) {
      recommended.maxIterations = 30;
    }

    return recommended;
  }
}

