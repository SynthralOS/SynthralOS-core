import { db } from '../config/database';
import { changeDetection } from '../../drizzle/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { scraperService } from './scraperService';
import crypto from 'crypto';

/**
 * Change Detection Service
 * 
 * Monitors web pages for changes and triggers workflows when changes are detected.
 * Uses content hashing and DOM diffing to detect changes.
 */

export interface ChangeDetectionConfig {
  url: string;
  selector?: string; // Optional CSS selector to monitor specific element
  checkInterval?: number; // Check interval in seconds (default: 3600)
  organizationId?: string;
  workspaceId?: string;
  userId?: string;
}

export interface ChangeResult {
  changed: boolean;
  changeType?: 'added' | 'removed' | 'modified' | 'structure';
  changeDetails?: any;
  previousHash?: string;
  currentHash?: string;
}

export class ChangeDetectionService {
  /**
   * Create or update a change detection monitor
   */
  async createMonitor(config: ChangeDetectionConfig): Promise<string> {
    const tracer = trace.getTracer('sos-change-detection');
    const span = tracer.startSpan('change_detection.create_monitor', {
      attributes: {
        'change_detection.url': config.url,
        'change_detection.selector': config.selector || '',
      },
    });

    try {
      // Check if monitor already exists
      const existing = await db
        .select()
        .from(changeDetection)
        .where(
          and(
            eq(changeDetection.url, config.url),
            config.selector
              ? eq(changeDetection.selector, config.selector)
              : sql`${changeDetection.selector} IS NULL`
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing monitor
        const monitor = existing[0];
        await db
          .update(changeDetection)
          .set({
            isActive: true,
            checkInterval: config.checkInterval || 3600,
            updatedAt: new Date(),
          })
          .where(eq(changeDetection.id, monitor.id));

        span.setAttributes({
          'change_detection.monitor_id': monitor.id,
          'change_detection.updated': true,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return monitor.id;
      }

      // Create new monitor
      const result = await db
        .insert(changeDetection)
        .values({
          organizationId: config.organizationId || null,
          workspaceId: config.workspaceId || null,
          userId: config.userId || null,
          url: config.url,
          selector: config.selector || null,
          checkInterval: config.checkInterval || 3600,
          isActive: true,
        })
        .returning({ id: changeDetection.id });

      span.setAttributes({
        'change_detection.monitor_id': result[0].id,
        'change_detection.created': true,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result[0].id;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      throw error;
    }
  }

  /**
   * Check for changes on a monitored URL
   */
  async checkForChanges(monitorId: string): Promise<ChangeResult> {
    const tracer = trace.getTracer('sos-change-detection');
    const span = tracer.startSpan('change_detection.check', {
      attributes: {
        'change_detection.monitor_id': monitorId,
      },
    });

    try {
      // Get monitor
      const monitors = await db
        .select()
        .from(changeDetection)
        .where(eq(changeDetection.id, monitorId))
        .limit(1);

      if (monitors.length === 0) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Monitor not found' });
        span.end();
        return { changed: false };
      }

      const monitor = monitors[0];

      if (!monitor.isActive) {
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return { changed: false };
      }

      // Fetch current content
      const scrapeResult = await scraperService.scrape({
        url: monitor.url,
        selectors: monitor.selector
          ? {
              monitored: monitor.selector,
            }
          : undefined,
        extractHtml: true,
      });

      if (!scrapeResult.success) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Failed to fetch content' });
        span.end();
        return { changed: false };
      }

      // Extract content to monitor
      let currentContent: string;
      if (monitor.selector && scrapeResult.data.monitored) {
        currentContent =
          typeof scrapeResult.data.monitored === 'string'
            ? scrapeResult.data.monitored
            : JSON.stringify(scrapeResult.data.monitored);
      } else {
        currentContent = scrapeResult.html || '';
      }

      // Calculate hash
      const currentHash = this.calculateHash(currentContent);

      // Compare with previous hash
      if (monitor.previousHash && monitor.previousHash === currentHash) {
        // No change detected
        await db
          .update(changeDetection)
          .set({
            lastCheckedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(changeDetection.id, monitorId));

        span.setAttributes({
          'change_detection.changed': false,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return { changed: false, previousHash: monitor.previousHash, currentHash };
      }

      // Change detected
      const changeType = this.detectChangeType(monitor.previousContent || '', currentContent);
      const changeDetails = this.analyzeChange(monitor.previousContent || '', currentContent);

      await db
        .update(changeDetection)
        .set({
          previousContent: monitor.currentContent || monitor.previousContent,
          previousHash: monitor.currentHash || monitor.previousHash,
          currentContent,
          currentHash,
          changeDetected: true,
          changeType,
          changeDetails,
          lastCheckedAt: new Date(),
          lastChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(changeDetection.id, monitorId));

      span.setAttributes({
        'change_detection.changed': true,
        'change_detection.change_type': changeType || '',
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return {
        changed: true,
        changeType,
        changeDetails,
        previousHash: monitor.previousHash || undefined,
        currentHash,
      };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      throw error;
    }
  }

  /**
   * Calculate content hash
   */
  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Detect change type
   */
  private detectChangeType(previousContent: string, currentContent: string): 'added' | 'removed' | 'modified' | 'structure' {
    if (!previousContent) {
      return 'added';
    }

    if (!currentContent) {
      return 'removed';
    }

    // Simple heuristic - in production, use more sophisticated diffing
    const previousLength = previousContent.length;
    const currentLength = currentContent.length;
    const lengthDiff = Math.abs(currentLength - previousLength) / Math.max(previousLength, 1);

    if (lengthDiff > 0.5) {
      return 'structure'; // Significant structural change
    }

    // Check if content is similar (simple comparison)
    const similarity = this.calculateSimilarity(previousContent, currentContent);
    if (similarity < 0.5) {
      return 'modified';
    }

    return 'modified';
  }

  /**
   * Calculate similarity between two strings (simple Jaccard similarity)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Analyze change details
   */
  private analyzeChange(previousContent: string, currentContent: string): any {
    return {
      previousLength: previousContent.length,
      currentLength: currentContent.length,
      lengthDiff: currentContent.length - previousContent.length,
      similarity: this.calculateSimilarity(previousContent, currentContent),
    };
  }

  /**
   * Get active monitors that need checking
   */
  async getMonitorsToCheck(): Promise<any[]> {
    try {
      const now = new Date();
      const monitors = await db
        .select()
        .from(changeDetection)
        .where(eq(changeDetection.isActive, true));

      return monitors.filter((monitor) => {
        if (!monitor.lastCheckedAt) {
          return true; // Never checked
        }

        const lastChecked = new Date(monitor.lastCheckedAt);
        const intervalMs = (monitor.checkInterval || 3600) * 1000;
        return now.getTime() - lastChecked.getTime() >= intervalMs;
      });
    } catch (error) {
      console.error('Failed to get monitors to check:', error);
      return [];
    }
  }

  /**
   * Get monitor by ID
   */
  async getMonitor(monitorId: string): Promise<any | null> {
    try {
      const monitors = await db
        .select()
        .from(changeDetection)
        .where(eq(changeDetection.id, monitorId))
        .limit(1);

      return monitors.length > 0 ? monitors[0] : null;
    } catch (error) {
      console.error('Failed to get monitor:', error);
      return null;
    }
  }

  /**
   * Update monitor status
   */
  async updateMonitorStatus(monitorId: string, isActive: boolean): Promise<void> {
    try {
      await db
        .update(changeDetection)
        .set({
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(changeDetection.id, monitorId));
    } catch (error) {
      console.error('Failed to update monitor status:', error);
      throw error;
    }
  }

  /**
   * Delete monitor
   */
  async deleteMonitor(monitorId: string): Promise<void> {
    try {
      await db.delete(changeDetection).where(eq(changeDetection.id, monitorId));
    } catch (error) {
      console.error('Failed to delete monitor:', error);
      throw error;
    }
  }
}

export const changeDetectionService = new ChangeDetectionService();

