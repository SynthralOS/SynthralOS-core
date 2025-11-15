import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { aiBrowserAgentService, AIBrowserAgentConfig } from '../aiBrowserAgentService';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { posthogService } from '../posthogService';
import { featureFlagService } from '../featureFlagService';

/**
 * AI Browser Agent Node Executor
 * 
 * Executes autonomous browser agents that can explore and interact with web pages
 * using AI-powered decision making.
 */

export async function executeAIBrowserAgent(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config, nodeId, executionId, userId, organizationId, workspaceId } = context;
  const nodeConfig = config as any;

  const tracer = trace.getTracer('sos-node-executor');
  const span = tracer.startSpan('node.execute.ai_browser_agent', {
    attributes: {
      'node.id': nodeId,
      'node.type': 'ai.browser_agent',
      'workflow.execution_id': executionId || '',
      'user.id': userId || '',
      'organization.id': organizationId || '',
      'workspace.id': workspaceId || '',
    },
  });

  const startTime = Date.now();

  try {
    // Check feature flag
    const isEnabled = await featureFlagService.isEnabled(
      'enable_ai_browser_agent',
      userId,
      workspaceId
    );

    if (!isEnabled) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'AI Browser Agent is disabled by feature flag',
      });
      span.end();

      return {
        success: false,
        error: {
          message: 'AI Browser Agent is disabled. Please enable the feature flag: enable_ai_browser_agent',
          code: 'FEATURE_DISABLED',
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Get goal from config or input
    const goal = (nodeConfig.goal as string) || (input.goal as string) || '';
    
    if (!goal) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Goal is required for AI Browser Agent',
      });
      span.end();
      
      return {
        success: false,
        error: {
          message: 'Goal is required for AI Browser Agent',
          code: 'MISSING_GOAL',
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Build agent config
    const agentConfig: AIBrowserAgentConfig = {
      goal,
      type: (nodeConfig.type as any) || (input.type as any) || 'react',
      provider: (nodeConfig.provider as 'openai' | 'anthropic') || (input.provider as 'openai' | 'anthropic') || 'openai',
      model: (nodeConfig.model as string) || (input.model as string),
      temperature: (nodeConfig.temperature as number) || (input.temperature as number) || 0.7,
      maxSteps: (nodeConfig.maxSteps as number) || (input.maxSteps as number) || 10,
      allowedActions: (nodeConfig.allowedActions as string[]) || (input.allowedActions as string[]),
      context: {
        organizationId: organizationId || undefined,
        workspaceId: workspaceId || undefined,
        userId: userId || undefined,
      },
    };

    span.setAttributes({
      'agent.goal': goal,
      'agent.max_steps': agentConfig.maxSteps || 10,
      'agent.provider': agentConfig.provider || 'openai',
    });

    // Execute AI browser agent
    const result = await aiBrowserAgentService.executeAgent(agentConfig);

    const executionTime = Date.now() - startTime;

    if (result.success) {
      span.setAttributes({
        'agent.success': true,
        'agent.steps_count': result.steps.length,
        'agent.execution_time_ms': executionTime,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      // Track in PostHog
      if (userId && organizationId) {
        const spanContext = span.spanContext();
        posthogService.trackToolUsed({
          userId,
          organizationId,
          workspaceId: workspaceId || undefined,
          toolId: nodeId,
          toolType: 'ai_browser_agent',
          status: 'success',
          latencyMs: executionTime,
          executionId: executionId || undefined,
          traceId: spanContext.traceId,
        });
      }

      span.end();

      return {
        success: true,
        output: {
          goal: result.goal,
          steps: result.steps,
          finalState: result.finalState,
          metadata: result.metadata,
        },
        metadata: {
          executionTime,
          stepsCount: result.steps.length,
          tokensUsed: result.metadata.tokensUsed,
          cost: result.metadata.cost,
        },
      };
    } else {
      span.setAttributes({
        'agent.success': false,
        'agent.error': result.error || 'Unknown error',
        'agent.execution_time_ms': executionTime,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: result.error || 'AI Browser Agent failed',
      });

      // Track failure in PostHog
      if (userId && organizationId) {
        const spanContext = span.spanContext();
        posthogService.trackToolUsed({
          userId,
          organizationId,
          workspaceId: workspaceId || undefined,
          toolId: nodeId,
          toolType: 'ai_browser_agent',
          status: 'error',
          latencyMs: executionTime,
          executionId: executionId || undefined,
          traceId: spanContext.traceId,
        });
      }

      span.end();

      return {
        success: false,
        error: {
          message: result.error || 'AI Browser Agent failed',
          code: 'AI_BROWSER_AGENT_ERROR',
          details: {
            goal: result.goal,
            steps: result.steps,
            metadata: result.metadata,
          },
        },
        metadata: {
          executionTime,
        },
      };
    }
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    span.recordException(error);
    span.setAttributes({
      'agent.success': false,
      'agent.error': error.message,
      'node.execution_time_ms': executionTime,
    });
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });

    // Track error in PostHog
    if (userId && organizationId) {
      const spanContext = span.spanContext();
      posthogService.trackToolUsed({
        userId,
        organizationId,
        workspaceId: workspaceId || undefined,
        toolId: nodeId,
        toolType: 'ai_browser_agent',
        status: 'error',
        latencyMs: executionTime,
        executionId: executionId || undefined,
        traceId: spanContext.traceId,
      });
    }

    span.end();

    return {
      success: false,
      error: {
        message: error.message || 'Unknown error during AI Browser Agent execution',
        code: error.code || 'AI_BROWSER_AGENT_EXECUTION_ERROR',
        details: error,
      },
      metadata: {
        executionTime,
      },
    };
  }
}

