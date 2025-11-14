import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { scraperService, ScrapeConfig } from '../scraperService';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { posthogService } from '../posthogService';

/**
 * Web Scrape Node Executor
 * 
 * Executes web scraping operations in workflow nodes.
 * Supports CSS selector-based data extraction from web pages.
 */
export async function executeWebScrape(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config, nodeId, executionId, userId, organizationId, workspaceId } = context;
  const nodeConfig = config as any;

  const tracer = trace.getTracer('sos-node-executor');
  const span = tracer.startSpan('node.execute.web_scrape', {
    attributes: {
      'node.id': nodeId,
      'node.type': 'action.web_scrape',
      'workflow.execution_id': executionId || '',
      'user.id': userId || '',
      'organization.id': organizationId || '',
      'workspace.id': workspaceId || '',
    },
  });

  const startTime = Date.now();

  try {
    // Get URL from input or config
    const url = (input.url as string) || nodeConfig.url || '';
    if (!url) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'URL is required for web scraping',
      });
      span.end();
      
      return {
        success: false,
        error: {
          message: 'URL is required for web scraping',
          code: 'MISSING_URL',
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Build scrape config
    const scrapeConfig: ScrapeConfig = {
      url,
      selectors: nodeConfig.selectors || input.selectors,
      extractText: nodeConfig.extractText !== false, // Default to true
      extractHtml: nodeConfig.extractHtml === true,
      extractAttributes: nodeConfig.extractAttributes || input.extractAttributes,
      timeout: nodeConfig.timeout || input.timeout || 30000,
      headers: {
        ...(nodeConfig.headers || {}),
        ...(input.headers || {}),
      },
      userAgent: nodeConfig.userAgent || input.userAgent,
      retries: nodeConfig.retries || input.retries || 2,
      retryDelay: nodeConfig.retryDelay || input.retryDelay || 1000,
      // Puppeteer options
      renderJavaScript: nodeConfig.renderJavaScript !== undefined 
        ? nodeConfig.renderJavaScript 
        : input.renderJavaScript,
      waitForSelector: nodeConfig.waitForSelector || input.waitForSelector,
      waitForTimeout: nodeConfig.waitForTimeout || input.waitForTimeout,
      executeJavaScript: nodeConfig.executeJavaScript || input.executeJavaScript,
      scrollToBottom: nodeConfig.scrollToBottom === true || input.scrollToBottom === true,
      viewport: nodeConfig.viewport || input.viewport,
      screenshot: nodeConfig.screenshot === true || input.screenshot === true,
    };

    span.setAttributes({
      'scraper.url': url,
      'scraper.selectors_count': scrapeConfig.selectors ? Object.keys(scrapeConfig.selectors).length : 0,
      'scraper.timeout': scrapeConfig.timeout || 30000,
    });

    // Execute scraping
    const result = await scraperService.scrape(scrapeConfig, {
      organizationId: organizationId || undefined,
      workspaceId: workspaceId || undefined,
      userId: userId || undefined,
    });

    const executionTime = Date.now() - startTime;

    if (result.success) {
      span.setAttributes({
        'scraper.success': true,
        'scraper.latency_ms': result.metadata.latency,
        'scraper.content_length': result.metadata.contentLength,
        'node.execution_time_ms': executionTime,
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
          toolType: 'web_scrape',
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
          data: result.data,
          html: result.html,
          url: result.url,
          metadata: result.metadata,
        },
        metadata: {
          executionTime,
          latency: result.metadata.latency,
          contentLength: result.metadata.contentLength,
        },
      };
    } else {
      span.setAttributes({
        'scraper.success': false,
        'scraper.error': result.error || 'Unknown error',
        'node.execution_time_ms': executionTime,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: result.error || 'Scraping failed',
      });

      // Track failure in PostHog
      if (userId && organizationId) {
        const spanContext = span.spanContext();
        posthogService.trackToolUsed({
          userId,
          organizationId,
          workspaceId: workspaceId || undefined,
          toolId: nodeId,
          toolType: 'web_scrape',
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
          message: result.error || 'Web scraping failed',
          code: 'SCRAPING_ERROR',
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
      'scraper.success': false,
      'scraper.error': error.message,
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
        toolType: 'web_scrape',
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
        message: error.message || 'Unknown error during web scraping',
        code: error.code || 'SCRAPING_EXECUTION_ERROR',
        details: error,
      },
      metadata: {
        executionTime,
      },
    };
  }
}

