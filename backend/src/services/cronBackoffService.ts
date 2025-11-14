/**
 * Cron Backoff Service
 * 
 * Manages exponential backoff for scheduled workflows that fail.
 * Tracks failure counts and calculates backoff delays to prevent
 * overwhelming systems with repeated failures.
 */

import { redis } from '../config/redis';
import { createId } from '@paralleldrive/cuid2';

/**
 * Backoff configuration
 */
export interface BackoffConfig {
  initialDelay: number; // Initial delay in milliseconds (default: 60000 = 1 minute)
  maxDelay: number; // Maximum delay in milliseconds (default: 86400000 = 24 hours)
  backoffMultiplier: number; // Multiplier for exponential backoff (default: 2)
  maxFailures: number; // Maximum consecutive failures before disabling (default: 10)
  resetOnSuccess: boolean; // Reset backoff on successful execution (default: true)
}

/**
 * Backoff state
 */
export interface BackoffState {
  jobKey: string;
  consecutiveFailures: number;
  nextRetryAt: Date | null;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
  disabled: boolean;
}

/**
 * Default backoff configuration
 */
const DEFAULT_CONFIG: BackoffConfig = {
  initialDelay: 60000, // 1 minute
  maxDelay: 86400000, // 24 hours
  backoffMultiplier: 2,
  maxFailures: 10,
  resetOnSuccess: true,
};

/**
 * Cron Backoff Service
 */
export class CronBackoffService {
  private config: BackoffConfig;
  private inMemoryStore: Map<string, BackoffState> = new Map();
  private useRedis: boolean = false;

  constructor(config: Partial<BackoffConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Check if Redis is available
    try {
      if (redis && redis.status === 'ready') {
        this.useRedis = true;
        console.log('✅ Cron backoff service using Redis');
      } else {
        console.log('⚠️ Cron backoff service using in-memory store (Redis not available)');
      }
    } catch (error) {
      console.warn('⚠️ Cron backoff service using in-memory store:', error);
    }
  }

  /**
   * Record a successful execution (resets backoff)
   */
  async recordSuccess(jobKey: string): Promise<void> {
    if (this.config.resetOnSuccess) {
      await this.resetBackoff(jobKey);
    } else {
      const state = await this.getState(jobKey);
      if (state) {
        state.lastSuccessAt = new Date();
        state.consecutiveFailures = 0;
        state.nextRetryAt = null;
        await this.setState(jobKey, state);
      }
    }
  }

  /**
   * Record a failed execution (increments backoff)
   */
  async recordFailure(jobKey: string): Promise<BackoffState> {
    const state = await this.getState(jobKey);
    
    const newState: BackoffState = {
      jobKey,
      consecutiveFailures: (state?.consecutiveFailures || 0) + 1,
      nextRetryAt: null,
      lastFailureAt: new Date(),
      lastSuccessAt: state?.lastSuccessAt || null,
      disabled: false,
    };

    // Calculate backoff delay
    const delay = this.calculateBackoff(newState.consecutiveFailures);
    newState.nextRetryAt = new Date(Date.now() + delay);

    // Disable if max failures reached
    if (newState.consecutiveFailures >= this.config.maxFailures) {
      newState.disabled = true;
      console.warn(`[Cron Backoff] Job ${jobKey} disabled after ${newState.consecutiveFailures} consecutive failures`);
    }

    await this.setState(jobKey, newState);
    return newState;
  }

  /**
   * Check if job should be executed (not in backoff period)
   */
  async shouldExecute(jobKey: string): Promise<{ shouldExecute: boolean; reason?: string; nextRetryAt?: Date }> {
    const state = await this.getState(jobKey);

    if (!state) {
      return { shouldExecute: true };
    }

    // Check if disabled
    if (state.disabled) {
      return {
        shouldExecute: false,
        reason: `Job disabled after ${state.consecutiveFailures} consecutive failures`,
        nextRetryAt: state.nextRetryAt || undefined,
      };
    }

    // Check if in backoff period
    if (state.nextRetryAt && state.nextRetryAt > new Date()) {
      return {
        shouldExecute: false,
        reason: `Job in backoff period (${state.consecutiveFailures} consecutive failures)`,
        nextRetryAt: state.nextRetryAt,
      };
    }

    return { shouldExecute: true };
  }

  /**
   * Reset backoff for a job
   */
  async resetBackoff(jobKey: string): Promise<void> {
    if (this.useRedis) {
      try {
        await redis.del(`cron_backoff:${jobKey}`);
      } catch (error: any) {
        console.warn(`[Cron Backoff] Failed to reset backoff in Redis for ${jobKey}:`, error);
        this.inMemoryStore.delete(jobKey);
      }
    } else {
      this.inMemoryStore.delete(jobKey);
    }
  }

  /**
   * Get backoff state for a job
   */
  async getState(jobKey: string): Promise<BackoffState | null> {
    if (this.useRedis) {
      try {
        const data = await redis.get(`cron_backoff:${jobKey}`);
        if (data) {
          const state = JSON.parse(data);
          // Convert date strings back to Date objects
          if (state.nextRetryAt) state.nextRetryAt = new Date(state.nextRetryAt);
          if (state.lastFailureAt) state.lastFailureAt = new Date(state.lastFailureAt);
          if (state.lastSuccessAt) state.lastSuccessAt = new Date(state.lastSuccessAt);
          return state;
        }
      } catch (error: any) {
        console.warn(`[Cron Backoff] Failed to get state from Redis for ${jobKey}:`, error);
      }
    }

    return this.inMemoryStore.get(jobKey) || null;
  }

  /**
   * Set backoff state for a job
   */
  private async setState(jobKey: string, state: BackoffState): Promise<void> {
    if (this.useRedis) {
      try {
        // Store with TTL (expire after 30 days of inactivity)
        await redis.setex(
          `cron_backoff:${jobKey}`,
          30 * 24 * 60 * 60, // 30 days
          JSON.stringify(state)
        );
      } catch (error: any) {
        console.warn(`[Cron Backoff] Failed to set state in Redis for ${jobKey}:`, error);
        this.inMemoryStore.set(jobKey, state);
      }
    } else {
      this.inMemoryStore.set(jobKey, state);
    }
  }

  /**
   * Calculate backoff delay based on failure count
   */
  private calculateBackoff(failureCount: number): number {
    // Exponential backoff: initialDelay * (multiplier ^ (failureCount - 1))
    const delay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier, failureCount - 1);
    
    // Cap at max delay
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Get all backoff states (for monitoring/debugging)
   */
  async getAllStates(): Promise<BackoffState[]> {
    if (this.useRedis) {
      try {
        const keys = await redis.keys('cron_backoff:*');
        const states: BackoffState[] = [];
        
        for (const key of keys) {
          const data = await redis.get(key);
          if (data) {
            const state = JSON.parse(data);
            if (state.nextRetryAt) state.nextRetryAt = new Date(state.nextRetryAt);
            if (state.lastFailureAt) state.lastFailureAt = new Date(state.lastFailureAt);
            if (state.lastSuccessAt) state.lastSuccessAt = new Date(state.lastSuccessAt);
            states.push(state);
          }
        }
        
        return states;
      } catch (error: any) {
        console.warn('[Cron Backoff] Failed to get all states from Redis:', error);
        return Array.from(this.inMemoryStore.values());
      }
    }

    return Array.from(this.inMemoryStore.values());
  }

  /**
   * Clean up expired backoff states
   */
  async cleanup(): Promise<void> {
    // Redis TTL handles expiration automatically
    // For in-memory store, clean up states older than 30 days
    if (!this.useRedis) {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      for (const [key, state] of this.inMemoryStore.entries()) {
        const lastActivity = state.lastFailureAt || state.lastSuccessAt;
        if (lastActivity && lastActivity.getTime() < thirtyDaysAgo) {
          this.inMemoryStore.delete(key);
        }
      }
    }
  }
}

// Singleton instance
export const cronBackoffService = new CronBackoffService();

// Cleanup expired states every hour
setInterval(() => {
  cronBackoffService.cleanup();
}, 60 * 60 * 1000);

