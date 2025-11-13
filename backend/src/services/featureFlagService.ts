/**
 * Feature Flag Service
 * 
 * Manages feature flags for users and workspaces
 * Supports plan-based flags, custom flags, and PostHog feature flags
 */

import { db } from '../config/database';
import { featureFlags } from '../../drizzle/schema';
import { createId } from '@paralleldrive/cuid2';
import { eq, and } from 'drizzle-orm';

class FeatureFlagService {
  private posthogClient: any = null;
  private posthogEnabled: boolean = false;

  constructor() {
    // Try to initialize PostHog client for feature flags
    try {
      const { PostHog } = require('posthog-node');
      
      if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST) {
        this.posthogClient = new PostHog(process.env.POSTHOG_API_KEY, {
          host: process.env.POSTHOG_HOST,
        });
        this.posthogEnabled = true;
      }
    } catch (error) {
      // PostHog not available, continue without it
      this.posthogEnabled = false;
    }
  }

  /**
   * Check if a feature flag is enabled for a user/workspace
   * Checks both database flags and PostHog feature flags
   */
  async isEnabled(
    flagName: string,
    userId?: string,
    workspaceId?: string
  ): Promise<boolean> {
    // First check PostHog feature flags if available
    if (this.posthogEnabled && this.posthogClient && userId) {
      try {
        const posthogFlag = await this.posthogClient.isFeatureEnabled(
          flagName,
          userId,
          {
            groups: workspaceId ? { workspace: workspaceId } : undefined,
          }
        );
        
        // If PostHog returns a value (not undefined), use it
        if (posthogFlag !== undefined) {
          return posthogFlag;
        }
      } catch (err: any) {
        console.warn('[FeatureFlag] PostHog flag check failed, falling back to database:', err);
      }
    }

    // Fall back to database flags
    try {
      const conditions = [eq(featureFlags.flagName, flagName)];
      
      if (userId) {
        conditions.push(eq(featureFlags.userId, userId));
      }
      if (workspaceId) {
        conditions.push(eq(featureFlags.workspaceId, workspaceId));
      }

      const [flag] = await db
        .select()
        .from(featureFlags)
        .where(and(...conditions))
        .limit(1);

      return flag?.isEnabled || false;
    } catch (err: any) {
      console.error('[FeatureFlag] Failed to check flag:', err);
      return false; // Default to disabled on error
    }
  }

  /**
   * Set a feature flag
   */
  async setFlag(
    flagName: string,
    isEnabled: boolean,
    userId?: string,
    workspaceId?: string
  ): Promise<void> {
    try {
      const conditions = [eq(featureFlags.flagName, flagName)];
      
      if (userId) {
        conditions.push(eq(featureFlags.userId, userId));
      }
      if (workspaceId) {
        conditions.push(eq(featureFlags.workspaceId, workspaceId));
      }

      const [existing] = await db
        .select()
        .from(featureFlags)
        .where(and(...conditions))
        .limit(1);

      if (existing) {
        // Update existing flag
        await db
          .update(featureFlags)
          .set({
            isEnabled,
            updatedAt: new Date(),
          })
          .where(eq(featureFlags.id, existing.id));
      } else {
        // Create new flag
        await db.insert(featureFlags).values({
          id: createId(),
          flagName,
          isEnabled,
          userId: userId || null,
          workspaceId: workspaceId || null,
        });
      }
    } catch (err: any) {
      console.error('[FeatureFlag] Failed to set flag:', err);
      throw err;
    }
  }

  /**
   * Get all flags for a user/workspace
   */
  async getFlags(userId?: string, workspaceId?: string): Promise<Array<{ flagName: string; isEnabled: boolean }>> {
    try {
      const conditions = [];
      
      if (userId) {
        conditions.push(eq(featureFlags.userId, userId));
      }
      if (workspaceId) {
        conditions.push(eq(featureFlags.workspaceId, workspaceId));
      }

      const flags = await db
        .select()
        .from(featureFlags)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return flags.map(f => ({
        flagName: f.flagName,
        isEnabled: f.isEnabled,
      }));
    } catch (err: any) {
      console.error('[FeatureFlag] Failed to get flags:', err);
      return [];
    }
  }

  /**
   * Get feature flag value with variant (for PostHog multivariate flags)
   */
  async getFlagVariant(
    flagName: string,
    userId?: string,
    workspaceId?: string
  ): Promise<{ enabled: boolean; variant?: string }> {
    // Check PostHog first
    if (this.posthogEnabled && this.posthogClient && userId) {
      try {
        const variant = await this.posthogClient.getFeatureFlag(
          flagName,
          userId,
          {
            groups: workspaceId ? { workspace: workspaceId } : undefined,
          }
        );
        
        if (variant !== undefined) {
          return {
            enabled: variant !== false && variant !== 'control',
            variant: typeof variant === 'string' ? variant : undefined,
          };
        }
      } catch (err: any) {
        console.warn('[FeatureFlag] PostHog variant check failed:', err);
      }
    }

    // Fall back to database
    const enabled = await this.isEnabled(flagName, userId, workspaceId);
    return { enabled };
  }

  /**
   * Shutdown PostHog client
   */
  async shutdown(): Promise<void> {
    if (this.posthogClient) {
      try {
        await this.posthogClient.shutdown();
      } catch (error) {
        console.warn('[FeatureFlag] Failed to shutdown PostHog client:', error);
      }
    }
  }
}

export const featureFlagService = new FeatureFlagService();

