/**
 * PostHog Service
 * 
 * Event tracking and analytics for agent executions
 * Works without PostHog if package is not installed
 * Forwards events to RudderStack if configured
 */

import { rudderstackService } from './rudderstackService';

interface AgentExecutionEvent {
  userId: string;
  organizationId: string;
  executionId: string;
  framework: string;
  query: string;
  success: boolean;
  executionTime: number; // ms
  tokensUsed?: number;
  cost?: number;
  error?: string;
}

class PosthogService {
  private client: any = null;
  private enabled: boolean = false;

  constructor() {
    try {
      // Try to import PostHog (optional dependency)
      const { PostHog } = require('posthog-node');
      
      if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST) {
        this.client = new PostHog(process.env.POSTHOG_API_KEY, {
          host: process.env.POSTHOG_HOST,
        });
        this.enabled = true;
        console.log('✅ PostHog client initialized');
      } else {
        console.warn('⚠️ PostHog API key or host not set, PostHog tracking disabled.');
      }
    } catch (error) {
      // PostHog not installed, continue without it
      console.log('ℹ️ PostHog not available (optional dependency)');
      this.enabled = false;
    }
  }

  /**
   * Track an agent execution event
   */
  trackAgentExecution(event: AgentExecutionEvent): void {
    if (!this.enabled || !this.client) return;

    try {
      const posthogEvent = {
        distinctId: event.userId,
        event: 'agent_execution',
        properties: {
          organizationId: event.organizationId,
          executionId: event.executionId,
          framework: event.framework,
          query: event.query,
          success: event.success,
          executionTime: event.executionTime,
          tokensUsed: event.tokensUsed,
          cost: event.cost,
          error: event.error,
        },
      };

      this.client.capture(posthogEvent);

      // Forward to RudderStack
      rudderstackService.forwardPostHogEvent({
        event: 'agent_execution',
        userId: event.userId,
        properties: posthogEvent.properties,
      });
    } catch (error) {
      console.warn('Failed to track agent execution in PostHog:', error);
    }
  }

  /**
   * Track an agent error event
   */
  trackAgentError(
    userId: string,
    organizationId: string,
    executionId: string,
    framework: string,
    errorMessage: string,
    errorCode: string
  ): void {
    if (!this.enabled || !this.client) return;

    try {
      const posthogEvent = {
        distinctId: userId,
        event: 'agent_error',
        properties: {
          organizationId,
          executionId,
          framework,
          errorMessage,
          errorCode,
        },
      };

      this.client.capture(posthogEvent);

      // Forward to RudderStack
      rudderstackService.forwardPostHogEvent({
        event: 'agent_error',
        userId,
        properties: posthogEvent.properties,
      });
    } catch (error) {
      console.warn('Failed to track agent error in PostHog:', error);
    }
  }

  /**
   * Track a workflow execution event
   */
  trackFlowExecuted(event: {
    userId: string;
    organizationId: string;
    workspaceId?: string;
    flowId: string;
    executionId: string;
    toolsUsed: string[];
    timeMs: number;
    success: boolean;
    traceId?: string;
  }): void {
    if (!this.enabled || !this.client) return;

    try {
      this.client.capture({
        distinctId: event.userId,
        event: 'flow_executed',
        properties: {
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          flowId: event.flowId,
          executionId: event.executionId,
          toolsUsed: event.toolsUsed,
          timeMs: event.timeMs,
          success: event.success,
          traceId: event.traceId,
        },
      });
    } catch (error) {
      console.warn('Failed to track flow execution in PostHog:', error);
    }
  }

  /**
   * Track a tool usage event
   */
  trackToolUsed(event: {
    userId: string;
    organizationId: string;
    workspaceId?: string;
    toolId: string;
    toolType: string;
    status: 'success' | 'error';
    latencyMs: number;
    executionId?: string;
    traceId?: string;
  }): void {
    if (!this.enabled || !this.client) return;

    try {
      const posthogEvent = {
        distinctId: event.userId,
        event: 'tool_used',
        properties: {
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          toolId: event.toolId,
          toolType: event.toolType,
          status: event.status,
          latencyMs: event.latencyMs,
          executionId: event.executionId,
          traceId: event.traceId,
        },
      };

      this.client.capture(posthogEvent);

      // Forward to RudderStack
      rudderstackService.forwardPostHogEvent({
        event: 'tool_used',
        userId: event.userId,
        properties: posthogEvent.properties,
      });
    } catch (error) {
      console.warn('Failed to track tool usage in PostHog:', error);
    }
  }

  /**
   * Track an agent creation event
   */
  trackAgentCreated(event: {
    userId: string;
    organizationId: string;
    workspaceId?: string;
    agentId: string;
    agentType: string;
    memoryBackend: string;
    framework?: string;
  }): void {
    if (!this.enabled || !this.client) return;

    try {
      const posthogEvent = {
        distinctId: event.userId,
        event: 'agent_created',
        properties: {
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          agentId: event.agentId,
          agentType: event.agentType,
          memoryBackend: event.memoryBackend,
          framework: event.framework,
        },
      };

      this.client.capture(posthogEvent);

      // Forward to RudderStack
      rudderstackService.forwardPostHogEvent({
        event: 'agent_created',
        userId: event.userId,
        properties: posthogEvent.properties,
      });
    } catch (error) {
      console.warn('Failed to track agent creation in PostHog:', error);
    }
  }

  /**
   * Track a prompt blocking event (guardrails)
   */
  trackPromptBlocked(event: {
    userId: string;
    organizationId: string;
    workspaceId?: string;
    matchScore: number;
    source: string;
    promptPreview?: string;
    reason?: string;
  }): void {
    if (!this.enabled || !this.client) return;

    try {
      const posthogEvent = {
        distinctId: event.userId,
        event: 'prompt_blocked',
        properties: {
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          matchScore: event.matchScore,
          source: event.source,
          promptPreview: event.promptPreview?.substring(0, 100), // Limit length
          reason: event.reason,
        },
      };

      this.client.capture(posthogEvent);

      // Forward to RudderStack
      rudderstackService.forwardPostHogEvent({
        event: 'prompt_blocked',
        userId: event.userId,
        properties: posthogEvent.properties,
      });
    } catch (error) {
      console.warn('Failed to track prompt blocking in PostHog:', error);
    }
  }

  /**
   * Track a RAG query event
   */
  trackRAGQueryTriggered(event: {
    userId: string;
    organizationId: string;
    workspaceId?: string;
    vectorDbUsed: string;
    indexName: string;
    latencyMs: number;
    sourcesFound: number;
    executionId?: string;
    traceId?: string;
  }): void {
    if (!this.enabled || !this.client) return;

    try {
      const posthogEvent = {
        distinctId: event.userId,
        event: 'rag_query_triggered',
        properties: {
          organizationId: event.organizationId,
          workspaceId: event.workspaceId,
          vectorDbUsed: event.vectorDbUsed,
          indexName: event.indexName,
          latencyMs: event.latencyMs,
          sourcesFound: event.sourcesFound,
          executionId: event.executionId,
          traceId: event.traceId,
        },
      };

      this.client.capture(posthogEvent);

      // Forward to RudderStack
      rudderstackService.forwardPostHogEvent({
        event: 'rag_query_triggered',
        userId: event.userId,
        properties: posthogEvent.properties,
      });
    } catch (error) {
      console.warn('Failed to track RAG query in PostHog:', error);
    }
  }

  /**
   * Flush events (useful before application shutdown)
   */
  async flush(): Promise<void> {
    if (this.client) {
      try {
        await this.client.shutdown();
      } catch (error) {
        console.warn('Failed to flush PostHog events:', error);
      }
    }
  }
}

export const posthogService = new PosthogService();
