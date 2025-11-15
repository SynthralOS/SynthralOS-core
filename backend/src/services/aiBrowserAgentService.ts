import { agentService, AgentConfig, AgentResponse } from './agentService';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * AI Browser Agent Service
 * 
 * Provides AI-powered autonomous browser automation.
 * Uses LangChain agents with browser automation tools to enable
 * goal-driven web exploration and interaction.
 */

export interface AIBrowserAgentConfig extends AgentConfig {
  goal: string; // Goal description (e.g., "Book a slot on this site every morning at 9 AM")
  maxSteps?: number; // Maximum number of browser actions
  allowedActions?: string[]; // Allowed browser actions (default: all)
  context?: {
    organizationId?: string;
    workspaceId?: string;
    userId?: string;
  };
}

export interface AIBrowserAgentResult {
  success: boolean;
  goal: string;
  steps: Array<{
    action: string;
    description: string;
    result: any;
  }>;
  finalState?: any;
  error?: string;
  metadata: {
    executionTime: number;
    stepsCount: number;
    tokensUsed?: number;
    cost?: number;
  };
}

// Browser automation tool is now registered in langtoolsService
// No need for separate tool class

export class AIBrowserAgentService {
  /**
   * Execute autonomous browser agent
   */
  async executeAgent(config: AIBrowserAgentConfig): Promise<AIBrowserAgentResult> {
    const tracer = trace.getTracer('sos-ai-browser-agent');
    const span = tracer.startSpan('ai_browser_agent.execute', {
      attributes: {
        'agent.goal': config.goal,
        'agent.max_steps': config.maxSteps || 10,
      },
    });

    const startTime = Date.now();
    const steps: Array<{ action: string; description: string; result: any }> = [];

    try {
      // Build agent config with browser automation tool
      const agentConfig: AgentConfig = {
        ...config,
        tools: ['browser_automation'], // Browser automation tool is registered in langtoolsService
        systemPrompt: config.systemPrompt || `You are an autonomous browser agent. Your goal is: ${config.goal}

You can use the browser_automation tool to:
- Navigate to URLs
- Click elements
- Fill forms
- Extract data
- Take screenshots
- Wait for elements
- Execute JavaScript

Plan your actions step by step to achieve the goal. Be careful and verify each step before proceeding.`,
      };

      // Create agent first
      const agentId = `ai-browser-agent-${Date.now()}`;
      await agentService.createAgent(agentId, {
        ...agentConfig,
        tools: ['browser_automation'], // Tool name, will be resolved by agentService
        maxIterations: config.maxSteps || 10,
      });

      // Execute agent with goal
      const agentResponse = await agentService.executeAgent(
        agentId,
        config.goal,
        {
          context: {
            goal: config.goal,
            allowedActions: config.allowedActions || ['navigate', 'click', 'fill', 'extract', 'screenshot', 'wait', 'evaluate'],
            browserContext: config.context,
          },
        }
      );

      const executionTime = Date.now() - startTime;

      // Parse intermediate steps to extract browser actions
      if (agentResponse.intermediateSteps) {
        for (const step of agentResponse.intermediateSteps) {
          if (step.action.tool === 'browser_automation') {
            try {
              const actionConfig = JSON.parse(step.action.toolInput);
              steps.push({
                action: actionConfig.action || 'unknown',
                description: `Executed ${actionConfig.action} action`,
                result: JSON.parse(step.observation),
              });
            } catch (error) {
              // Skip invalid steps
            }
          }
        }
      }

      span.setAttributes({
        'agent.success': true,
        'agent.steps_count': steps.length,
        'agent.execution_time_ms': executionTime,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return {
        success: true,
        goal: config.goal,
        steps,
        finalState: {
          output: agentResponse.output,
          messages: agentResponse.memory?.messages,
        },
        metadata: {
          executionTime,
          stepsCount: steps.length,
          tokensUsed: agentResponse.tokensUsed,
          cost: agentResponse.cost,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      span.recordException(error);
      span.setAttributes({
        'agent.success': false,
        'agent.error': error.message,
        'agent.execution_time_ms': executionTime,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();

      return {
        success: false,
        goal: config.goal,
        steps,
        error: error.message || 'Unknown error',
        metadata: {
          executionTime,
          stepsCount: steps.length,
        },
      };
    }
  }
}

export const aiBrowserAgentService = new AIBrowserAgentService();

