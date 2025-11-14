import { db } from '../config/database';
import { proxyPools, proxyLogs, proxyScores } from '../../drizzle/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Proxy Service
 * 
 * Manages proxy pools, rotation, scoring, and validation for web scraping.
 * Supports multiple proxy types (residential, datacenter, mobile, ISP) and providers.
 */

export interface ProxyConfig {
  id: string; // Proxy ID from database
  host: string;
  port: number;
  username?: string;
  password?: string;
  protocol?: 'http' | 'https' | 'socks4' | 'socks5';
}

export interface ProxySelectionOptions {
  organizationId?: string;
  country?: string;
  city?: string;
  type?: 'residential' | 'datacenter' | 'mobile' | 'isp';
  minScore?: number; // Minimum score (0-100)
  excludeProxyIds?: string[];
}

export interface ProxyUsageResult {
  success: boolean;
  statusCode?: number;
  latencyMs?: number;
  banReason?: string;
  errorMessage?: string;
}

export class ProxyService {
  /**
   * Get proxy by ID
   */
  async getProxyById(proxyId: string): Promise<ProxyConfig | null> {
    try {
      const proxies = await db
        .select()
        .from(proxyPools)
        .where(eq(proxyPools.id, proxyId))
        .limit(1);

      if (proxies.length === 0 || !proxies[0].isActive) {
        return null;
      }

      const proxy = proxies[0];
      return {
        id: proxy.id,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
        protocol: 'http',
      };
    } catch (error) {
      console.error('Failed to get proxy by ID:', error);
      return null;
    }
  }

  /**
   * Get the best available proxy based on scoring and filters
   */
  async getProxy(options: ProxySelectionOptions = {}): Promise<ProxyConfig | null> {
    const tracer = trace.getTracer('sos-proxy-service');
    const span = tracer.startSpan('proxy.get', {
      attributes: {
        'proxy.organization_id': options.organizationId || '',
        'proxy.country': options.country || '',
        'proxy.type': options.type || '',
        'proxy.min_score': options.minScore || 0,
      },
    });

    try {
      // Build query conditions
      const conditions = [];

      if (options.organizationId) {
        conditions.push(eq(proxyPools.organizationId, options.organizationId));
      } else {
        // If no organization specified, get global proxies (null organizationId)
        conditions.push(sql`${proxyPools.organizationId} IS NULL`);
      }

      conditions.push(eq(proxyPools.isActive, true));

      if (options.country) {
        conditions.push(eq(proxyPools.country, options.country));
      }

      if (options.city) {
        conditions.push(eq(proxyPools.city, options.city));
      }

      if (options.type) {
        conditions.push(eq(proxyPools.type, options.type));
      }

      if (options.excludeProxyIds && options.excludeProxyIds.length > 0) {
        conditions.push(sql`${proxyPools.id} NOT IN ${sql.raw(`(${options.excludeProxyIds.map(id => `'${id}'`).join(',')})`)}`);
      }

      // Get active proxies
      const proxies = await db
        .select()
        .from(proxyPools)
        .where(and(...conditions))
        .limit(100); // Limit to prevent too many results

      if (proxies.length === 0) {
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return null;
      }

      // Get scores for proxies
      const proxyIds = proxies.map(p => p.id);
      const scores = await db
        .select()
        .from(proxyScores)
        .where(sql`${proxyScores.proxyId} IN ${sql.raw(`(${proxyIds.map(id => `'${id}'`).join(',')})`)}`);

      // Create score map
      const scoreMap = new Map(scores.map(s => [s.proxyId, s]));

      // Filter by minimum score and sort by score (highest first)
      const scoredProxies = proxies
        .map(proxy => {
          const score = scoreMap.get(proxy.id);
          return {
            proxy,
            score: score?.score || 50, // Default score if no score exists
            scoreRecord: score,
          };
        })
        .filter(item => {
          const minScore = options.minScore || 0;
          return item.score >= minScore;
        })
        .sort((a, b) => b.score - a.score); // Sort by score descending

      if (scoredProxies.length === 0) {
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return null;
      }

      // Select proxy using weighted random (higher score = higher chance)
      const selected = this.selectWeightedProxy(scoredProxies);
      const proxy = selected.proxy;

      span.setAttributes({
        'proxy.id': proxy.id,
        'proxy.type': proxy.type,
        'proxy.score': selected.score,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return {
        id: proxy.id,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
        protocol: 'http', // Default to HTTP, can be extended
      };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      throw error;
    }
  }

  /**
   * Select proxy using weighted random selection
   */
  private selectWeightedProxy(
    scoredProxies: Array<{ proxy: any; score: number; scoreRecord: any }>
  ): { proxy: any; score: number; scoreRecord: any } {
    // Calculate total weight (sum of scores)
    const totalWeight = scoredProxies.reduce((sum, item) => sum + item.score, 0);

    // Generate random number between 0 and totalWeight
    let random = Math.random() * totalWeight;

    // Select proxy based on weight
    for (const item of scoredProxies) {
      random -= item.score;
      if (random <= 0) {
        return item;
      }
    }

    // Fallback to first proxy (shouldn't happen)
    return scoredProxies[0];
  }

  /**
   * Log proxy usage
   */
  async logUsage(
    proxyId: string,
    result: ProxyUsageResult,
    context: {
      organizationId?: string;
      workspaceId?: string;
      userId?: string;
      url: string;
    }
  ): Promise<void> {
    const tracer = trace.getTracer('sos-proxy-service');
    const span = tracer.startSpan('proxy.log_usage', {
      attributes: {
        'proxy.id': proxyId,
        'proxy.success': result.success,
        'proxy.status_code': result.statusCode || 0,
        'proxy.latency_ms': result.latencyMs || 0,
      },
    });

    try {
      const status = result.success
        ? 'success'
        : result.banReason
        ? 'banned'
        : result.errorMessage?.includes('timeout')
        ? 'timeout'
        : 'failed';

      await db.insert(proxyLogs).values({
        proxyId,
        organizationId: context.organizationId || null,
        workspaceId: context.workspaceId || null,
        userId: context.userId || null,
        url: context.url,
        status,
        statusCode: result.statusCode || null,
        latencyMs: result.latencyMs || null,
        banReason: result.banReason || null,
        errorMessage: result.errorMessage || null,
      });

      // Update proxy score asynchronously (don't wait)
      this.updateProxyScore(proxyId, result).catch((err) => {
        console.error('Failed to update proxy score:', err);
      });

      // Update last used timestamp
      await db
        .update(proxyPools)
        .set({ updatedAt: new Date() })
        .where(eq(proxyPools.id, proxyId));

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      // Don't throw - logging should not break scraping
      console.error('Failed to log proxy usage:', error);
    }
  }

  /**
   * Update proxy score based on usage
   */
  private async updateProxyScore(proxyId: string, result: ProxyUsageResult): Promise<void> {
    try {
      // Get recent logs (last 100 requests)
      const recentLogs = await db
        .select()
        .from(proxyLogs)
        .where(eq(proxyLogs.proxyId, proxyId))
        .orderBy(desc(proxyLogs.createdAt))
        .limit(100);

      if (recentLogs.length === 0) {
        return;
      }

      // Calculate statistics
      const totalRequests = recentLogs.length;
      const successfulRequests = recentLogs.filter(log => log.status === 'success').length;
      const failedRequests = recentLogs.filter(log => log.status === 'failed').length;
      const bannedRequests = recentLogs.filter(log => log.status === 'banned').length;

      const successRate = Math.round((successfulRequests / totalRequests) * 100);
      const banRate = Math.round((bannedRequests / totalRequests) * 100);

      // Calculate average latency
      const latencyLogs = recentLogs.filter(log => log.latencyMs !== null);
      const avgLatencyMs =
        latencyLogs.length > 0
          ? Math.round(
              latencyLogs.reduce((sum, log) => sum + (log.latencyMs || 0), 0) / latencyLogs.length
            )
          : null;

      // Calculate overall score (0-100)
      // Score = (successRate * 0.7) - (banRate * 0.3) + (latencyBonus)
      // Latency bonus: lower latency = higher bonus (max 20 points)
      let score = successRate * 0.7 - banRate * 0.3;
      if (avgLatencyMs !== null) {
        // Latency bonus: < 500ms = 20, < 1000ms = 15, < 2000ms = 10, < 5000ms = 5, else 0
        if (avgLatencyMs < 500) {
          score += 20;
        } else if (avgLatencyMs < 1000) {
          score += 15;
        } else if (avgLatencyMs < 2000) {
          score += 10;
        } else if (avgLatencyMs < 5000) {
          score += 5;
        }
      }
      score = Math.max(0, Math.min(100, Math.round(score))); // Clamp to 0-100

      // Get or create score record
      const existingScores = await db
        .select()
        .from(proxyScores)
        .where(eq(proxyScores.proxyId, proxyId))
        .limit(1);

      const proxy = await db
        .select()
        .from(proxyPools)
        .where(eq(proxyPools.id, proxyId))
        .limit(1);

      const organizationId = proxy[0]?.organizationId || null;

      if (existingScores.length > 0) {
        // Update existing score
        await db
          .update(proxyScores)
          .set({
            score,
            successRate,
            avgLatencyMs: avgLatencyMs || null,
            banRate,
            totalRequests,
            successfulRequests,
            failedRequests,
            bannedRequests,
            lastUsedAt: new Date(),
            lastScoredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(proxyScores.proxyId, proxyId));
      } else {
        // Create new score record
        await db.insert(proxyScores).values({
          proxyId,
          organizationId,
          score,
          successRate,
          avgLatencyMs: avgLatencyMs || null,
          banRate,
          totalRequests,
          successfulRequests,
          failedRequests,
          bannedRequests,
          lastUsedAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to update proxy score:', error);
    }
  }

  /**
   * Validate proxy connectivity
   */
  async validateProxy(proxyId: string, testUrl: string = 'https://httpbin.org/ip'): Promise<boolean> {
    const tracer = trace.getTracer('sos-proxy-service');
    const span = tracer.startSpan('proxy.validate', {
      attributes: {
        'proxy.id': proxyId,
        'proxy.test_url': testUrl,
      },
    });

    try {
      const proxies = await db
        .select()
        .from(proxyPools)
        .where(eq(proxyPools.id, proxyId))
        .limit(1);

      if (proxies.length === 0) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Proxy not found' });
        span.end();
        return false;
      }

      const proxy = proxies[0];
      const proxyConfig: ProxyConfig = {
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
      };

      // Test proxy connectivity (simplified - in production, use actual HTTP request)
      // For now, we'll just check if proxy exists and is active
      const isValid = proxy.isActive;

      span.setAttributes({
        'proxy.valid': isValid,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return isValid;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.end();
      return false;
    }
  }

  /**
   * Get proxy statistics
   */
  async getProxyStats(proxyId: string): Promise<any> {
    try {
      const scores = await db
        .select()
        .from(proxyScores)
        .where(eq(proxyScores.proxyId, proxyId))
        .limit(1);

      if (scores.length === 0) {
        return null;
      }

      return scores[0];
    } catch (error) {
      console.error('Failed to get proxy stats:', error);
      return null;
    }
  }

  /**
   * Get proxies by organization
   */
  async getProxiesByOrganization(organizationId: string): Promise<any[]> {
    try {
      const proxies = await db
        .select()
        .from(proxyPools)
        .where(eq(proxyPools.organizationId, organizationId));

      return proxies;
    } catch (error) {
      console.error('Failed to get proxies by organization:', error);
      return [];
    }
  }

  /**
   * Add proxy to pool
   */
  async addProxy(
    config: {
      organizationId?: string;
      name: string;
      type: 'residential' | 'datacenter' | 'mobile' | 'isp';
      provider?: string;
      host: string;
      port: number;
      username?: string;
      password?: string;
      country?: string;
      city?: string;
      maxConcurrent?: number;
      metadata?: any;
    }
  ): Promise<string> {
    try {
      const result = await db
        .insert(proxyPools)
        .values({
          organizationId: config.organizationId || null,
          name: config.name,
          type: config.type,
          provider: config.provider || null,
          host: config.host,
          port: config.port,
          username: config.username || null,
          password: config.password || null,
          country: config.country || null,
          city: config.city || null,
          maxConcurrent: config.maxConcurrent || 10,
          metadata: config.metadata || null,
        })
        .returning({ id: proxyPools.id });

      return result[0].id;
    } catch (error) {
      console.error('Failed to add proxy:', error);
      throw error;
    }
  }

  /**
   * Remove proxy from pool
   */
  async removeProxy(proxyId: string): Promise<void> {
    try {
      await db.delete(proxyPools).where(eq(proxyPools.id, proxyId));
    } catch (error) {
      console.error('Failed to remove proxy:', error);
      throw error;
    }
  }

  /**
   * Update proxy status
   */
  async updateProxyStatus(proxyId: string, isActive: boolean): Promise<void> {
    try {
      await db
        .update(proxyPools)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(proxyPools.id, proxyId));
    } catch (error) {
      console.error('Failed to update proxy status:', error);
      throw error;
    }
  }
}

export const proxyService = new ProxyService();

