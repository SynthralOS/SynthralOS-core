import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { ragHelperClickerService, RAGHelperClickerConfig } from '../ragHelperClickerService';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { posthogService } from '../posthogService';
import { featureFlagService } from '../featureFlagService';

/**
 * RAG Helper Clicker Node Executor
 * 
 * Executes RAG Helper Clicker workflow:
 * Open page → Extract content → Split text → Store in vector DB
 */

export async function executeRAGHelperClicker(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config, nodeId, executionId, userId, organizationId, workspaceId } = context;
  const nodeConfig = config as any;

  const tracer = trace.getTracer('sos-node-executor');
  const span = tracer.startSpan('node.execute.rag_helper_clicker', {
    attributes: {
      'node.id': nodeId,
      'node.type': 'ai.rag_helper_clicker',
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
      'enable_rag_helper_clicker',
      userId,
      workspaceId
    );

    if (!isEnabled) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'RAG Helper Clicker is disabled by feature flag',
      });
      span.end();

      return {
        success: false,
        error: {
          message: 'RAG Helper Clicker is disabled. Please enable the feature flag: enable_rag_helper_clicker',
          code: 'FEATURE_DISABLED',
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Get URL from config or input
    const url = (nodeConfig.url as string) || (input.url as string) || '';
    if (!url) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'URL is required for RAG Helper Clicker',
      });
      span.end();
      
      return {
        success: false,
        error: {
          message: 'URL is required for RAG Helper Clicker',
          code: 'MISSING_URL',
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Get vector store ID
    const vectorStoreId = (nodeConfig.vectorStoreId as string) || (input.vectorStoreId as string) || '';
    if (!vectorStoreId) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'vectorStoreId is required for RAG Helper Clicker',
      });
      span.end();
      
      return {
        success: false,
        error: {
          message: 'vectorStoreId is required for RAG Helper Clicker',
          code: 'MISSING_VECTOR_STORE_ID',
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Build RAG Helper Clicker config
    const ragConfig: RAGHelperClickerConfig = {
      url,
      vectorStoreId,
      chunkSize: (nodeConfig.chunkSize as number) || (input.chunkSize as number) || 1000,
      chunkOverlap: (nodeConfig.chunkOverlap as number) || (input.chunkOverlap as number) || 200,
      selector: (nodeConfig.selector as string) || (input.selector as string),
      useBrowserAutomation: nodeConfig.useBrowserAutomation === true || input.useBrowserAutomation === true,
      context: {
        organizationId: organizationId || undefined,
        workspaceId: workspaceId || undefined,
        userId: userId || undefined,
      },
    };

    span.setAttributes({
      'rag.url': url,
      'rag.vector_store_id': vectorStoreId,
      'rag.use_browser': ragConfig.useBrowserAutomation || false,
    });

    // Execute RAG Helper Clicker
    const result = await ragHelperClickerService.execute(ragConfig);

    const executionTime = Date.now() - startTime;

    if (result.success) {
      span.setAttributes({
        'rag.success': true,
        'rag.chunks_created': result.chunksCreated,
        'rag.text_length': result.totalTextLength,
        'rag.execution_time_ms': executionTime,
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
          toolType: 'rag_helper_clicker',
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
          url: result.url,
          chunksCreated: result.chunksCreated,
          totalTextLength: result.totalTextLength,
          metadata: result.metadata,
        },
        metadata: {
          executionTime,
          chunksCreated: result.chunksCreated,
          extractionMethod: result.metadata.extractionMethod,
        },
      };
    } else {
      span.setAttributes({
        'rag.success': false,
        'rag.error': result.error || 'Unknown error',
        'rag.execution_time_ms': executionTime,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: result.error || 'RAG Helper Clicker failed',
      });

      // Track failure in PostHog
      if (userId && organizationId) {
        const spanContext = span.spanContext();
        posthogService.trackToolUsed({
          userId,
          organizationId,
          workspaceId: workspaceId || undefined,
          toolId: nodeId,
          toolType: 'rag_helper_clicker',
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
          message: result.error || 'RAG Helper Clicker failed',
          code: 'RAG_HELPER_CLICKER_ERROR',
          details: {
            url: result.url,
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
      'rag.success': false,
      'rag.error': error.message,
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
        toolType: 'rag_helper_clicker',
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
        message: error.message || 'Unknown error during RAG Helper Clicker execution',
        code: error.code || 'RAG_HELPER_CLICKER_EXECUTION_ERROR',
        details: error,
      },
      metadata: {
        executionTime,
      },
    };
  }
}

