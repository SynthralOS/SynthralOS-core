import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { aiService } from '../aiService';
import { db } from '../../config/database';
import { modelCostLogs } from '../../../drizzle/schema';
import { createId } from '@paralleldrive/cuid2';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { featureFlagService } from '../featureFlagService';

export async function executeLLM(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const prompt = (input.prompt as string) || nodeConfig.prompt || '';
  if (!prompt) {
    return {
      success: false,
      error: {
        message: 'Prompt is required for LLM node',
        code: 'MISSING_PROMPT',
      },
    };
  }

  const startTime = Date.now();
  const modelName = nodeConfig.model || 'gpt-3.5-turbo';
  const provider = (nodeConfig.provider as 'openai' | 'anthropic' | 'google') || 'openai';

  // Create OpenTelemetry span for LLM execution
  const tracer = trace.getTracer('sos-llm-executor');
  const span = tracer.startSpan('llm.generate', {
    attributes: {
      'llm.provider': provider,
      'llm.model': modelName,
      'node.id': context.nodeId,
      'workflow.id': context.workflowId,
      'workflow.execution_id': context.executionId,
    },
  });

  let traceId: string | undefined;
  try {
    const spanContext = span.spanContext();
    traceId = spanContext.traceId;

    const result = await aiService.generateText({
      prompt,
      config: {
        provider,
        model: modelName,
        temperature: nodeConfig.temperature || 0.7,
        maxTokens: nodeConfig.maxTokens || 1000,
        systemPrompt: nodeConfig.systemPrompt,
      },
      variables: {
        ...input,
        context: input.context,
      },
    });

    // Calculate cost details
    // tokensUsed can be a number or an object with input/output
    let inputTokens = 0;
    let outputTokens = 0;
    
    if (typeof result.tokensUsed === 'number') {
      // If it's a number, try to get breakdown from metadata
      const metadata = result.metadata as any;
      const tokenUsage = metadata?.tokenUsage || metadata?.usage;
      if (tokenUsage) {
        inputTokens = tokenUsage.promptTokens || tokenUsage.inputTokens || 0;
        outputTokens = tokenUsage.completionTokens || tokenUsage.outputTokens || 0;
      } else {
        // If no breakdown, estimate 50/50 split (rough approximation)
        inputTokens = Math.floor(result.tokensUsed / 2);
        outputTokens = result.tokensUsed - inputTokens;
      }
    } else if (result.tokensUsed && typeof result.tokensUsed === 'object') {
      inputTokens = (result.tokensUsed as any).input || 0;
      outputTokens = (result.tokensUsed as any).output || 0;
    }
    
    const totalTokens = inputTokens + outputTokens;
    const cost = result.cost || 0;
    
    // Calculate rate per 1k tokens (in cents for precision)
    const ratePer1k = totalTokens > 0 ? Math.round((cost / totalTokens) * 1000 * 100) : 0;
    const costUsdCents = Math.round(cost * 100); // Convert to cents

    const latencyMs = Date.now() - startTime;

    // Update span with LLM execution details
    span.setAttributes({
      'llm.input_tokens': inputTokens,
      'llm.output_tokens': outputTokens,
      'llm.total_tokens': totalTokens,
      'llm.cost_usd': cost,
      'llm.latency_ms': latencyMs,
      'llm.status': 'success',
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();

    // Write to model_cost_logs (if feature flag enabled)
    try {
      const trackCosts = await featureFlagService.isEnabled(
        'track_model_costs',
        context.userId,
        (context as any).workspaceId
      );
      
      if (trackCosts) {
        await db.insert(modelCostLogs).values({
          id: createId(),
          userId: context.userId || null,
          agentId: context.workflowId || null,
          modelName: `${provider}:${modelName}`,
          inputTokens,
          outputTokens,
          ratePer1k,
          costUsd: costUsdCents,
          traceId: traceId || context.executionId || null,
          timestamp: new Date(),
        });
      }
    } catch (err: any) {
      console.error('[LLM Executor] Failed to write cost log:', err);
      // Don't throw - observability should not break execution
    }

    return {
      success: true,
      output: {
        text: result.content,
        tokens: result.tokensUsed,
      },
      metadata: {
        tokensUsed: result.tokensUsed,
        cost: result.cost,
      },
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;

    // Update span with error
    span.setAttributes({
      'llm.status': 'error',
      'llm.latency_ms': latencyMs,
      'llm.error': error.message || 'LLM execution failed',
      'llm.error_code': error.code || 'LLM_ERROR',
    });
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message || 'LLM execution failed',
    });
    span.end();

    return {
      success: false,
      error: {
        message: error.message || 'LLM execution failed',
        code: 'LLM_ERROR',
        details: error,
      },
    };
  }
}

