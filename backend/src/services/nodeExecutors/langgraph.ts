import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { langgraphService, LangGraphWorkflowConfig } from '../langgraphService';

/**
 * LangGraph Workflow Node Executor
 * 
 * Executes LangGraph workflows for complex stateful operations
 */

export async function executeLangGraphWorkflow(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config, workflowId } = context;
  const nodeConfig = config as any;

  const langgraphWorkflowId = (nodeConfig.workflowId as string) || `langgraph_${workflowId}`;
  const workflowConfig = (nodeConfig.workflowConfig as LangGraphWorkflowConfig) || null;
  const stream = (nodeConfig.stream as boolean) || false;

  try {
    // If workflow config is provided, create/update the workflow
    if (workflowConfig) {
      await langgraphService.createWorkflow({
        ...workflowConfig,
        workflowId: langgraphWorkflowId,
      });
    }

    // Prepare input state
    const inputState = {
      messages: (input.messages as any[]) || [],
      data: (input.data as Record<string, unknown>) || input || {},
      step: (input.step as number) || 0,
      metadata: (input.metadata as Record<string, unknown>) || {},
    };

    // Execute workflow
    if (stream) {
      // Stream execution (for real-time updates)
      const results: Partial<any>[] = [];
      for await (const state of langgraphService.streamWorkflow(langgraphWorkflowId, inputState)) {
        results.push(state);
      }
      
      return {
        success: true,
        output: {
          states: results,
          finalState: results[results.length - 1],
        },
        metadata: {
          workflowId: langgraphWorkflowId,
          streamed: true,
          steps: results.length,
        },
      };
    } else {
      // Regular execution
      const result = await langgraphService.executeWorkflow(langgraphWorkflowId, inputState);

      return {
        success: true,
        output: {
          messages: result.messages.map(m => ({
            type: m.constructor.name,
            content: m.getContent(),
          })),
          data: result.data,
          step: result.step,
          metadata: result.metadata,
        },
        metadata: {
          workflowId: langgraphWorkflowId,
          steps: result.step,
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'LangGraph workflow execution failed',
        code: 'LANGGRAPH_ERROR',
        details: error,
      },
    };
  }
}

