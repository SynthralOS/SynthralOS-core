import { codeAgentRegistry } from './codeAgentRegistry';
import { executeCode } from './nodeExecutors/code';
import { NodeExecutionContext } from '@sos/shared';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * ETL Hook Service
 * 
 * Executes code agents as ETL hooks in RAG pipeline:
 * - Pre-ingest hooks: Transform documents before chunking
 * - Post-answer hooks: Enhance LLM answers after generation
 */

export interface PreIngestHookInput {
  document: string;
  fileType?: string;
  metadata?: Record<string, any>;
}

export interface PostAnswerHookInput {
  answer: string;
  context: string;
  sources: Array<{ text: string; score: number; metadata?: Record<string, any> }>;
  query: string;
}

export class ETLHookService {
  /**
   * Execute pre-ingest hook
   * Transforms document content before chunking
   */
  async executePreIngestHook(
    agentId: string,
    input: PreIngestHookInput,
    workflowId: string
  ): Promise<{ success: boolean; document?: string; error?: string }> {
    const tracer = trace.getTracer('sos-etl-hook-service');
    const span = tracer.startSpan('etlHook.preIngest', {
      attributes: {
        'hook.agent_id': agentId,
        'hook.type': 'pre_ingest',
        'workflow.id': workflowId,
      },
    });

    try {
      const agent = await codeAgentRegistry.getAgent(agentId);
      if (!agent) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Agent not found' });
        return {
          success: false,
          error: 'Code agent not found',
        };
      }

      // Increment usage count
      await codeAgentRegistry.incrementUsage(agentId);

      // Execute hook
      const hookContext: NodeExecutionContext = {
        input: {
          document: input.document,
          fileType: input.fileType,
          metadata: input.metadata || {},
        },
        config: {
          code: agent.code,
          runtime: agent.runtime,
          packages: agent.packages || [],
        },
        workflowId,
        nodeId: `pre-ingest-hook-${agentId}`,
      };

      const result = await executeCode(hookContext, agent.language);

      if (!result.success) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: result.error?.message || 'Hook execution failed',
        });
        return {
          success: false,
          error: result.error?.message || 'Hook execution failed',
        };
      }

      // Extract processed document from result
      let processedDocument = input.document;
      if (result.output?.output) {
        const output = result.output.output;
        if (typeof output === 'string') {
          processedDocument = output;
        } else if (output && typeof output === 'object') {
          if ('document' in output) {
            processedDocument = output.document as string;
          } else if ('processedDocument' in output) {
            processedDocument = output.processedDocument as string;
          } else if ('content' in output) {
            processedDocument = output.content as string;
          }
        }
      }

      span.setAttributes({
        'hook.success': true,
        'hook.output_length': processedDocument.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return {
        success: true,
        document: processedDocument,
      };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      return {
        success: false,
        error: error.message || 'Pre-ingest hook execution failed',
      };
    } finally {
      span.end();
    }
  }

  /**
   * Execute post-answer hook
   * Enhances LLM answer after generation
   */
  async executePostAnswerHook(
    agentId: string,
    input: PostAnswerHookInput,
    workflowId: string
  ): Promise<{ success: boolean; answer?: string; error?: string }> {
    const tracer = trace.getTracer('sos-etl-hook-service');
    const span = tracer.startSpan('etlHook.postAnswer', {
      attributes: {
        'hook.agent_id': agentId,
        'hook.type': 'post_answer',
        'workflow.id': workflowId,
      },
    });

    try {
      const agent = await codeAgentRegistry.getAgent(agentId);
      if (!agent) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Agent not found' });
        return {
          success: false,
          error: 'Code agent not found',
        };
      }

      // Increment usage count
      await codeAgentRegistry.incrementUsage(agentId);

      // Execute hook
      const hookContext: NodeExecutionContext = {
        input: {
          answer: input.answer,
          context: input.context,
          sources: input.sources,
          query: input.query,
        },
        config: {
          code: agent.code,
          runtime: agent.runtime,
          packages: agent.packages || [],
        },
        workflowId,
        nodeId: `post-answer-hook-${agentId}`,
      };

      const result = await executeCode(hookContext, agent.language);

      if (!result.success) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: result.error?.message || 'Hook execution failed',
        });
        return {
          success: false,
          error: result.error?.message || 'Hook execution failed',
        };
      }

      // Extract enhanced answer from result
      let enhancedAnswer = input.answer;
      if (result.output?.output) {
        const output = result.output.output;
        if (typeof output === 'string') {
          enhancedAnswer = output;
        } else if (output && typeof output === 'object') {
          if ('answer' in output) {
            enhancedAnswer = output.answer as string;
          } else if ('enhancedAnswer' in output) {
            enhancedAnswer = output.enhancedAnswer as string;
          } else if ('content' in output) {
            enhancedAnswer = output.content as string;
          }
        }
      }

      span.setAttributes({
        'hook.success': true,
        'hook.output_length': enhancedAnswer.length,
      });
      span.setStatus({ code: SpanStatusCode.OK });

      return {
        success: true,
        answer: enhancedAnswer,
      };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      return {
        success: false,
        error: error.message || 'Post-answer hook execution failed',
      };
    } finally {
      span.end();
    }
  }
}

export const etlHookService = new ETLHookService();

