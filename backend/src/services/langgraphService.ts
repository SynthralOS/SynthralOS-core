import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { langchainService } from "./langchainService";

/**
 * LangGraph Service - For complex stateful workflows
 * 
 * This service provides stateful workflow execution using LangGraph,
 * which is ideal for:
 * - Multi-step agent workflows
 * - Human-in-the-loop interactions
 * - Stateful conversations
 * - Complex decision trees
 */

export interface WorkflowState {
  messages: BaseMessage[];
  data: Record<string, unknown>;
  step: number;
  metadata?: Record<string, unknown>;
}

export interface LangGraphWorkflowConfig {
  workflowId: string;
  nodes: Array<{
    id: string;
    type: 'llm' | 'tool' | 'condition' | 'custom';
    config: Record<string, unknown>;
    handler?: (state: WorkflowState) => Promise<Partial<WorkflowState>>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    condition?: (state: WorkflowState) => boolean;
  }>;
  initialState?: Partial<WorkflowState>;
}

export class LangGraphService {
  private graphs: Map<string, StateGraph> = new Map();

  /**
   * Create a LangGraph workflow from configuration
   */
  async createWorkflow(config: LangGraphWorkflowConfig): Promise<string> {
    // Define state annotation for LangGraph v1.0
    const StateAnnotation = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      }),
      data: Annotation<Record<string, unknown>>({
        reducer: (x: Record<string, unknown>, y: Record<string, unknown>) => ({ ...x, ...y }),
        default: () => ({}),
      }),
      step: Annotation<number>({
        reducer: (x: number, y: number) => y,
        default: () => 0,
      }),
      metadata: Annotation<Record<string, unknown>>({
        reducer: (x: Record<string, unknown>, y: Record<string, unknown>) => ({ ...x, ...y }),
        default: () => ({}),
      }),
    });

    const graph = new StateGraph(StateAnnotation);

    // Add nodes
    for (const node of config.nodes) {
      graph.addNode(node.id, async (state: any) => {
        return await this.executeNode(node, state as WorkflowState);
      });
    }

    // Add edges
    for (const edge of config.edges) {
      if (edge.condition) {
        graph.addConditionalEdges(
          edge.from,
          (state: any) => {
            return edge.condition!(state as WorkflowState) ? edge.to : END;
          },
          {
            [edge.to]: edge.to,
            [END]: END,
          }
        );
      } else {
        graph.addEdge(edge.from, edge.to);
      }
    }

    // Set entry point
    const entryNode = config.nodes.find(n => 
      !config.edges.some(e => e.to === n.id)
    );
    if (entryNode) {
      graph.addEdge(START, entryNode.id);
    }

    // Set exit point
    const exitNodes = config.nodes.filter(n =>
      !config.edges.some(e => e.from === n.id)
    );
    for (const exitNode of exitNodes) {
      graph.addEdge(exitNode.id, END);
    }

    // Compile the graph
    const compiledGraph = graph.compile();
    this.graphs.set(config.workflowId, compiledGraph as any);

    return config.workflowId;
  }

  /**
   * Execute a node in the workflow
   */
  private async executeNode(
    node: LangGraphWorkflowConfig['nodes'][0],
    state: WorkflowState
  ): Promise<Partial<WorkflowState>> {
    switch (node.type) {
      case 'llm':
        return await this.executeLLMNode(node, state);
      case 'tool':
        return await this.executeToolNode(node, state);
      case 'condition':
        return await this.executeConditionNode(node, state);
      case 'custom':
        if (node.handler) {
          return await node.handler(state);
        }
        return {};
      default:
        return {};
    }
  }

  /**
   * Execute an LLM node
   */
  private async executeLLMNode(
    node: LangGraphWorkflowConfig['nodes'][0],
    state: WorkflowState
  ): Promise<Partial<WorkflowState>> {
    const config = node.config as any;
    const provider = config.provider || 'openai';
    const model = config.model || 'gpt-3.5-turbo';
    const prompt = config.prompt || '';
    const systemPrompt = config.systemPrompt;

    // Get last user message or use prompt
    const lastMessage = state.messages[state.messages.length - 1];
    const userMessage = lastMessage?.getContent() || prompt;

    // Generate response using LangChain
    const response = await langchainService.generateText(
      userMessage,
      {
        provider: provider as 'openai' | 'anthropic',
        model,
        systemPrompt,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens,
      }
    );

    // Create messages
    const messages: BaseMessage[] = [];
    if (userMessage && !lastMessage) {
      messages.push(new HumanMessage(userMessage));
    }
    messages.push(new AIMessage(response.content));

    return {
      messages,
      step: state.step + 1,
      data: {
        ...state.data,
        [`${node.id}_output`]: response.content,
      },
    };
  }

  /**
   * Execute a tool node
   */
  private async executeToolNode(
    node: LangGraphWorkflowConfig['nodes'][0],
    state: WorkflowState
  ): Promise<Partial<WorkflowState>> {
    const config = node.config as any;
    const toolName = config.toolName || '';
    const toolInput = config.input || state.data;

    // Tool execution will be handled by the tools service
    // This is a placeholder - actual tool execution happens in langtoolsService
    return {
      step: state.step + 1,
      data: {
        ...state.data,
        [`${node.id}_tool_result`]: `Tool ${toolName} executed`,
      },
    };
  }

  /**
   * Execute a condition node
   */
  private async executeConditionNode(
    node: LangGraphWorkflowConfig['nodes'][0],
    state: WorkflowState
  ): Promise<Partial<WorkflowState>> {
    const config = node.config as any;
    const condition = config.condition || (() => true);
    
    // Evaluate condition
    const result = typeof condition === 'function' 
      ? condition(state) 
      : condition;

    return {
      step: state.step + 1,
      data: {
        ...state.data,
        [`${node.id}_condition`]: result,
      },
    };
  }

  /**
   * Execute a LangGraph workflow
   */
  async executeWorkflow(
    workflowId: string,
    input: Partial<WorkflowState>
  ): Promise<WorkflowState> {
    const graph = this.graphs.get(workflowId);
    if (!graph) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const initialState: WorkflowState = {
      messages: input.messages || [],
      data: input.data || {},
      step: 0,
      metadata: input.metadata || {},
    };

    const result = await graph.invoke(initialState as any);
    return result as WorkflowState;
  }

  /**
   * Stream workflow execution (for real-time updates)
   */
  async *streamWorkflow(
    workflowId: string,
    input: Partial<WorkflowState>
  ): AsyncGenerator<Partial<WorkflowState>, void, unknown> {
    const graph = this.graphs.get(workflowId);
    if (!graph) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const initialState: WorkflowState = {
      messages: input.messages || [],
      data: input.data || {},
      step: 0,
      metadata: input.metadata || {},
    };

    for await (const state of graph.stream(initialState as any)) {
      yield state as Partial<WorkflowState>;
    }
  }

  /**
   * Get workflow state at a checkpoint
   */
  async getWorkflowState(workflowId: string, checkpointId: string): Promise<WorkflowState | null> {
    // This would integrate with LangGraph's checkpointing system
    // For now, return null (checkpointing requires additional setup)
    return null;
  }
}

export const langgraphService = new LangGraphService();

