import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import { browserSwitchService, BrowserTaskConfig } from '../browserSwitchService';
import { browserAutomationService, BrowserActionConfig } from '../browserAutomationService';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { posthogService } from '../posthogService';
import { featureFlagService } from '../featureFlagService';

/**
 * Browser Switch Node Executor
 * 
 * Executes browser automation with intelligent routing between engines.
 * Uses LangGraph-style conditional routing based on task requirements.
 */

export async function executeBrowserSwitch(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config, nodeId, executionId, userId, organizationId, workspaceId } = context;
  const nodeConfig = config as any;

  const tracer = trace.getTracer('sos-node-executor');
  const span = tracer.startSpan('node.execute.browser_switch', {
    attributes: {
      'node.id': nodeId,
      'node.type': 'action.browser_switch',
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
      'enable_browser_switch_node',
      userId,
      workspaceId
    );

    if (!isEnabled) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Browser switch node is disabled by feature flag',
      });
      span.end();

      return {
        success: false,
        error: {
          message: 'Browser switch node is disabled. Please enable the feature flag: enable_browser_switch_node',
          code: 'FEATURE_DISABLED',
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Get action from config or input
    const action = (nodeConfig.action as string) || (input.action as string) || 'navigate';
    
    if (!['navigate', 'click', 'fill', 'extract', 'screenshot', 'wait', 'evaluate'].includes(action)) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Invalid action: ${action}`,
      });
      span.end();
      
      return {
        success: false,
        error: {
          message: `Invalid action: ${action}. Must be one of: navigate, click, fill, extract, screenshot, wait, evaluate`,
          code: 'INVALID_ACTION',
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }

    // Build task config for routing
    const taskConfig: BrowserTaskConfig = {
      url: (nodeConfig.url as string) || (input.url as string),
      action: action as any,
      htmlType: (nodeConfig.htmlType as 'static' | 'dynamic') || (input.htmlType as 'static' | 'dynamic'),
      headlessScrapingNeeded: nodeConfig.headlessScrapingNeeded === true || input.headlessScrapingNeeded === true,
      massiveBrowserScale: nodeConfig.massiveBrowserScale === true || input.massiveBrowserScale === true,
      browserLightweightTask: nodeConfig.browserLightweightTask === true || input.browserLightweightTask === true,
      autonomousWebExploration: nodeConfig.autonomousWebExploration === true || input.autonomousWebExploration === true,
      dynamicContentMonitoring: nodeConfig.dynamicContentMonitoring === true || input.dynamicContentMonitoring === true,
      requiresInteraction: nodeConfig.requiresInteraction === true || input.requiresInteraction === true,
      has403429: nodeConfig.has403429 === true || input.has403429 === true,
      cloudflareBlock: nodeConfig.cloudflareBlock === true || input.cloudflareBlock === true,
      explicitEngine: (nodeConfig.explicitEngine as 'playwright' | 'puppeteer') || (input.explicitEngine as 'playwright' | 'puppeteer'),
    };

    // Route to optimal engine
    const routingDecision = await browserSwitchService.route(taskConfig);

    span.setAttributes({
      'browser.routing.engine': routingDecision.engine,
      'browser.routing.reason': routingDecision.reason,
      'browser.routing.confidence': routingDecision.confidence,
      'browser.action': action,
    });

    // Build browser action config
    const actionConfig: BrowserActionConfig = {
      action: action as any,
      url: taskConfig.url,
      selector: (nodeConfig.selector as string) || (input.selector as string),
      text: (nodeConfig.text as string) || (input.text as string),
      value: (nodeConfig.value as string) || (input.value as string),
      waitForSelector: (nodeConfig.waitForSelector as string) || (input.waitForSelector as string),
      waitTimeout: (nodeConfig.waitTimeout as number) || (input.waitTimeout as number) || 30000,
      screenshot: nodeConfig.screenshot === true || input.screenshot === true,
      extractSelectors: (nodeConfig.extractSelectors as Record<string, string>) || (input.extractSelectors as Record<string, string>),
      evaluateScript: (nodeConfig.evaluateScript as string) || (input.evaluateScript as string),
      explicitEngine: routingDecision.engine,
      htmlType: taskConfig.htmlType,
      requiresInteraction: taskConfig.requiresInteraction,
      useProxy: nodeConfig.useProxy === true || input.useProxy === true,
      context: {
        organizationId: organizationId || undefined,
        workspaceId: workspaceId || undefined,
        userId: userId || undefined,
      },
    };

    // Execute browser action
    const result = await browserAutomationService.executeAction(actionConfig);

    const executionTime = Date.now() - startTime;

    if (result.success) {
      span.setAttributes({
        'browser.success': true,
        'browser.latency_ms': result.metadata.latency,
        'browser.engine_used': result.metadata.engine,
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
          toolType: 'browser_switch',
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
          action: result.action,
          data: result.data,
          screenshot: result.screenshot,
          html: result.html,
          routing: {
            engine: routingDecision.engine,
            reason: routingDecision.reason,
            confidence: routingDecision.confidence,
          },
          metadata: result.metadata,
        },
        metadata: {
          executionTime,
          latency: result.metadata.latency,
          engine: result.metadata.engine,
          routingConfidence: routingDecision.confidence,
        },
      };
    } else {
      span.setAttributes({
        'browser.success': false,
        'browser.error': result.error || 'Unknown error',
        'browser.latency_ms': result.metadata.latency,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: result.error || 'Browser automation failed',
      });

      // Track failure in PostHog
      if (userId && organizationId) {
        const spanContext = span.spanContext();
        posthogService.trackToolUsed({
          userId,
          organizationId,
          workspaceId: workspaceId || undefined,
          toolId: nodeId,
          toolType: 'browser_switch',
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
          message: result.error || 'Browser automation failed',
          code: 'BROWSER_SWITCH_ERROR',
          details: {
            action: result.action,
            routing: {
              engine: routingDecision.engine,
              reason: routingDecision.reason,
              confidence: routingDecision.confidence,
            },
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
      'browser.success': false,
      'browser.error': error.message,
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
        toolType: 'browser_switch',
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
        message: error.message || 'Unknown error during browser switch execution',
        code: error.code || 'BROWSER_SWITCH_EXECUTION_ERROR',
        details: error,
      },
      metadata: {
        executionTime,
      },
    };
  }
}

