/**
 * RudderStack Service
 * 
 * Event forwarding service for analytics
 * Forwards events from PostHog and Supabase to RudderStack
 * Maps events to unified analytics schema
 */

interface RudderStackEvent {
  event: string;
  userId?: string;
  anonymousId?: string;
  properties?: Record<string, unknown>;
  context?: {
    groupId?: string;
    traits?: Record<string, unknown>;
    [key: string]: unknown;
  };
  timestamp?: Date;
}

class RudderStackService {
  private client: any = null;
  private enabled: boolean = false;
  private writeKey: string | null = null;
  private dataPlaneUrl: string | null = null;

  constructor() {
    try {
      const RudderStack = require('@rudderstack/rudder-sdk-node');
      
      this.writeKey = process.env.RUDDERSTACK_WRITE_KEY || null;
      this.dataPlaneUrl = process.env.RUDDERSTACK_DATA_PLANE_URL || 'https://hosted.rudderlabs.com';

      if (this.writeKey) {
        this.client = new RudderStack(this.writeKey, {
          dataPlaneUrl: this.dataPlaneUrl,
          flushAt: 20, // Flush after 20 events
          flushInterval: 10000, // Or flush every 10 seconds
        });
        this.enabled = true;
        console.log('✅ RudderStack client initialized');
      } else {
        console.warn('⚠️ RUDDERSTACK_WRITE_KEY not set, RudderStack forwarding disabled');
      }
    } catch (error) {
      console.log('ℹ️ RudderStack not available (optional dependency)');
      this.enabled = false;
    }
  }

  /**
   * Identify a user
   */
  identify(
    userId: string,
    traits?: Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    if (!this.enabled || !this.client) return;

    try {
      this.client.identify({
        userId,
        traits: traits || {},
        context: {
          ...context,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.warn('Failed to identify user in RudderStack:', error);
    }
  }

  /**
   * Track an event
   */
  track(
    userId: string,
    event: string,
    properties?: Record<string, unknown>,
    context?: {
      groupId?: string;
      workspaceId?: string;
      organizationId?: string;
      traceId?: string;
      [key: string]: unknown;
    }
  ): void {
    if (!this.enabled || !this.client) return;

    try {
      const eventData: RudderStackEvent = {
        event,
        userId,
        properties: properties || {},
        context: {
          ...context,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      // Add group context if workspace/organization provided
      if (context?.workspaceId) {
        eventData.context = {
          ...eventData.context,
          groupId: context.workspaceId,
          traits: {
            workspaceId: context.workspaceId,
            organizationId: context.organizationId,
          },
        };
      }

      this.client.track(eventData);
    } catch (error) {
      console.warn('Failed to track event in RudderStack:', error);
    }
  }

  /**
   * Track a group (workspace/organization)
   */
  group(
    userId: string,
    groupId: string,
    traits?: Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    if (!this.enabled || !this.client) return;

    try {
      this.client.group({
        userId,
        groupId,
        traits: traits || {},
        context: {
          ...context,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.warn('Failed to track group in RudderStack:', error);
    }
  }

  /**
   * Map PostHog event to RudderStack event
   */
  mapPostHogEvent(
    posthogEvent: {
      event: string;
      userId: string;
      properties: Record<string, unknown>;
    }
  ): RudderStackEvent {
    // Extract common properties
    const { organizationId, workspaceId, traceId, executionId, ...otherProps } = posthogEvent.properties as Record<string, unknown>;

    return {
      event: posthogEvent.event,
      userId: posthogEvent.userId,
      properties: {
        ...otherProps,
        // Ensure trace_id is included
        trace_id: traceId,
        execution_id: executionId,
      },
      context: {
        groupId: workspaceId as string,
        traits: {
          organizationId,
          workspaceId,
        },
        traceId,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Forward PostHog event to RudderStack
   */
  forwardPostHogEvent(
    posthogEvent: {
      event: string;
      userId: string;
      properties: Record<string, unknown>;
    }
  ): void {
    if (!this.enabled || !this.client) return;

    try {
      const rudderEvent = this.mapPostHogEvent(posthogEvent);
      this.client.track(rudderEvent);
    } catch (error) {
      console.warn('Failed to forward PostHog event to RudderStack:', error);
    }
  }

  /**
   * Forward database event to RudderStack
   * Maps Supabase/PostgreSQL events to RudderStack format
   */
  forwardDatabaseEvent(
    event: {
      eventType: string;
      userId?: string;
      workspaceId?: string;
      organizationId?: string;
      properties: Record<string, unknown>;
      traceId?: string;
    }
  ): void {
    if (!this.enabled || !this.client) return;

    try {
      this.track(
        event.userId || 'anonymous',
        event.eventType,
        event.properties,
        {
          workspaceId: event.workspaceId,
          organizationId: event.organizationId,
          traceId: event.traceId,
        }
      );
    } catch (error) {
      console.warn('Failed to forward database event to RudderStack:', error);
    }
  }

  /**
   * Flush events (useful before application shutdown)
   */
  async flush(): Promise<void> {
    if (this.client) {
      try {
        await this.client.flush();
      } catch (error) {
        console.warn('Failed to flush RudderStack events:', error);
      }
    }
  }

  /**
   * Shutdown RudderStack client
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.flush();
        // RudderStack SDK doesn't have explicit shutdown, but flush should be enough
      } catch (error) {
        console.warn('Failed to shutdown RudderStack client:', error);
      }
    }
  }
}

export const rudderstackService = new RudderStackService();

