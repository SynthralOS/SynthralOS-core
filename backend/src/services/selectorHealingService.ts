import { db } from '../config/database';
import { scraperSelectors } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { scraperService } from './scraperService';

/**
 * Selector Healing Service
 * 
 * Monitors selector success rates and automatically suggests/updates
 * selectors when they fail. Uses LLM to analyze HTML and suggest alternatives.
 */

export interface SelectorFailure {
  url: string;
  fieldName: string;
  selector: string;
  selectorType: 'css' | 'xpath';
  html: string;
  error: string;
}

export interface SelectorSuggestion {
  selector: string;
  selectorType: 'css' | 'xpath';
  confidence: number; // 0-1
  reason: string;
}

export class SelectorHealingService {
  private readonly failureThreshold = 0.3; // 30% failure rate triggers healing
  private readonly minAttempts = 10; // Minimum attempts before considering healing

  /**
   * Record selector usage (success or failure)
   */
  async recordSelectorUsage(
    url: string,
    fieldName: string,
    selector: string,
    selectorType: 'css' | 'xpath',
    success: boolean,
    context?: {
      organizationId?: string;
      workspaceId?: string;
    }
  ): Promise<void> {
    const tracer = trace.getTracer('sos-selector-healing');
    const span = tracer.startSpan('selector.record_usage', {
      attributes: {
        'selector.url': url,
        'selector.field_name': fieldName,
        'selector.selector': selector,
        'selector.type': selectorType,
        'selector.success': success,
      },
    });

    try {
      // Find existing selector record
      const existing = await db
        .select()
        .from(scraperSelectors)
        .where(
          and(
            eq(scraperSelectors.url, url),
            eq(scraperSelectors.fieldName, fieldName),
            eq(scraperSelectors.selector, selector)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        const record = existing[0];
        const successCount = success ? record.successCount + 1 : record.successCount;
        const failureCount = success ? record.failureCount : record.failureCount + 1;

        await db
          .update(scraperSelectors)
          .set({
            successCount,
            failureCount,
            lastSuccessAt: success ? new Date() : record.lastSuccessAt,
            lastFailureAt: success ? record.lastFailureAt : new Date(),
            updatedAt: new Date(),
          })
          .where(eq(scraperSelectors.id, record.id));

        // Check if healing is needed
        const totalAttempts = successCount + failureCount;
        if (totalAttempts >= this.minAttempts) {
          const failureRate = failureCount / totalAttempts;
          if (failureRate >= this.failureThreshold) {
            // Trigger healing process (async, don't wait)
            this.attemptHealing(record.id, url, fieldName, selector, selectorType).catch(
              (err) => {
                console.error('Failed to attempt selector healing:', err);
              }
            );
          }
        }
      } else {
        // Create new record
        await db.insert(scraperSelectors).values({
          organizationId: context?.organizationId || null,
          workspaceId: context?.workspaceId || null,
          url,
          fieldName,
          selector,
          selectorType,
          successCount: success ? 1 : 0,
          failureCount: success ? 0 : 1,
          lastSuccessAt: success ? new Date() : null,
          lastFailureAt: success ? null : new Date(),
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      console.error('Failed to record selector usage:', error);
    }
  }

  /**
   * Attempt to heal a failing selector
   */
  private async attemptHealing(
    selectorId: string,
    url: string,
    fieldName: string,
    oldSelector: string,
    selectorType: 'css' | 'xpath'
  ): Promise<void> {
    const tracer = trace.getTracer('sos-selector-healing');
    const span = tracer.startSpan('selector.attempt_healing', {
      attributes: {
        'selector.id': selectorId,
        'selector.url': url,
        'selector.field_name': fieldName,
      },
    });

    try {
      // Fetch current HTML
      const scrapeResult = await scraperService.scrape({
        url,
        extractHtml: true,
      });

      if (!scrapeResult.success || !scrapeResult.html) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Failed to fetch HTML' });
        span.end();
        return;
      }

      // Use LLM to suggest new selectors
      const suggestions = await this.suggestSelectors(
        scrapeResult.html,
        fieldName,
        oldSelector,
        selectorType
      );

      if (suggestions.length === 0) {
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return;
      }

      // Test suggestions and update if successful
      for (const suggestion of suggestions) {
        const testResult = await this.testSelector(url, fieldName, suggestion.selector, suggestion.selectorType);
        
        if (testResult.success) {
          // Update selector
          await db
            .update(scraperSelectors)
            .set({
              selector: suggestion.selector,
              selectorType: suggestion.selectorType,
              successCount: 1,
              failureCount: 0,
              lastSuccessAt: new Date(),
              lastFailureAt: null,
              updatedAt: new Date(),
              metadata: {
                healed: true,
                previousSelector: oldSelector,
                healedAt: new Date().toISOString(),
                confidence: suggestion.confidence,
              },
            })
            .where(eq(scraperSelectors.id, selectorId));

          span.setAttributes({
            'selector.healed': true,
            'selector.new_selector': suggestion.selector,
            'selector.confidence': suggestion.confidence,
          });
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return;
        }
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      console.error('Failed to attempt selector healing:', error);
    }
  }

  /**
   * Suggest new selectors using LLM
   */
  private async suggestSelectors(
    html: string,
    fieldName: string,
    oldSelector: string,
    selectorType: 'css' | 'xpath'
  ): Promise<SelectorSuggestion[]> {
    // Simplified implementation - in production, use actual LLM
    // For now, return empty array (placeholder)
    // TODO: Integrate with LLM service to analyze HTML and suggest selectors
    
    return [];
  }

  /**
   * Test a selector
   */
  private async testSelector(
    url: string,
    fieldName: string,
    selector: string,
    selectorType: 'css' | 'xpath'
  ): Promise<{ success: boolean; data?: any }> {
    try {
      const result = await scraperService.scrape({
        url,
        selectors: {
          [fieldName]: selector,
        },
      });

      if (result.success && result.data[fieldName] !== null && result.data[fieldName] !== undefined) {
        return { success: true, data: result.data[fieldName] };
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Get selector statistics
   */
  async getSelectorStats(
    url: string,
    fieldName: string
  ): Promise<any> {
    try {
      const selectors = await db
        .select()
        .from(scraperSelectors)
        .where(
          and(
            eq(scraperSelectors.url, url),
            eq(scraperSelectors.fieldName, fieldName)
          )
        )
        .orderBy(desc(scraperSelectors.updatedAt));

      return selectors.map((s) => ({
        id: s.id,
        selector: s.selector,
        selectorType: s.selectorType,
        successCount: s.successCount,
        failureCount: s.failureCount,
        successRate: s.successCount + s.failureCount > 0
          ? s.successCount / (s.successCount + s.failureCount)
          : 0,
        isActive: s.isActive,
        lastSuccessAt: s.lastSuccessAt,
        lastFailureAt: s.lastFailureAt,
      }));
    } catch (error) {
      console.error('Failed to get selector stats:', error);
      return [];
    }
  }
}

export const selectorHealingService = new SelectorHealingService();

