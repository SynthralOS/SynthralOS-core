import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { db } from '../../config/database';
import { workflowExecutions } from '../../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { websocketService } from '../websocketService';
import redis from '../../config/redis';

/**
 * Execute human prompt node
 * 
 * Pauses execution and waits for human input
 */
export async function executeHumanPrompt(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { executionId, nodeId, config } = context;
  const nodeConfig = config as any;

  const prompt = nodeConfig.prompt || 'Please provide input';
  const inputSchema = nodeConfig.inputSchema || {};
  const timeout = nodeConfig.timeout || 3600000; // Default 1 hour

  try {
    // Get execution
    const [execution] = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, executionId))
      .limit(1);

    if (!execution) {
      return {
        success: false,
        error: {
          message: 'Execution not found',
          code: 'EXECUTION_NOT_FOUND',
        },
      };
    }

    // Pause execution
    const metadata = (execution.metadata as any) || {};
    await db.update(workflowExecutions).set({
      status: 'paused',
      metadata: {
        ...metadata,
        humanPrompt: {
          nodeId,
          prompt,
          inputSchema,
          requestedAt: new Date(),
        },
      },
    }).where(eq(workflowExecutions.id, executionId));

    // Emit WebSocket event for human prompt
    websocketService.emitHumanPrompt(executionId, {
      nodeId,
      prompt,
      inputSchema,
    });

    // Wait for human response using Redis pub/sub
    const response = await waitForHumanResponse(executionId, nodeId, timeout);

    // Resume execution
    await db.update(workflowExecutions).set({
      status: 'running',
      metadata: {
        ...metadata,
        humanPrompt: undefined,
      },
    }).where(eq(workflowExecutions.id, executionId));

    return {
      success: true,
      output: response,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Human prompt failed',
        code: 'HUMAN_PROMPT_ERROR',
      },
    };
  }
}

/**
 * Wait for human response via Redis pub/sub
 */
function waitForHumanResponse(
  executionId: string,
  nodeId: string,
  timeout: number
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const subscriber = redis.duplicate();
    const channel = `execution:${executionId}:human-prompt:${nodeId}`;

    subscriber.subscribe(channel);

    const timeoutId = setTimeout(() => {
      subscriber.unsubscribe();
      subscriber.quit();
      reject(new Error('Human prompt timeout'));
    }, timeout);

    subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        clearTimeout(timeoutId);
        subscriber.unsubscribe();
        subscriber.quit();

        try {
          const response = JSON.parse(message);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid response format'));
        }
      }
    });

    subscriber.on('error', (error) => {
      clearTimeout(timeoutId);
      subscriber.unsubscribe();
      subscriber.quit();
      reject(error);
    });
  });
}

