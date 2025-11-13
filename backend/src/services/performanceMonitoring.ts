import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  successCount: number;
  lastRequestAt: string;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  requests: {
    total: number;
    perSecond: number;
    errors: number;
    successRate: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  database: {
    queryCount: number;
    averageQueryTime: number;
  };
}

class PerformanceMonitoringService {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private startTime = Date.now();

  /**
   * Record request performance
   */
  recordRequest(
    method: string,
    endpoint: string,
    duration: number,
    statusCode: number
  ): void {
    const key = `${method}:${endpoint}`;
    
    // Update endpoint metrics
    const existing = this.metrics.get(key) || {
      endpoint,
      method,
      count: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errorCount: 0,
      successCount: 0,
      lastRequestAt: new Date().toISOString(),
    };

    existing.count++;
    existing.totalTime += duration;
    existing.averageTime = existing.totalTime / existing.count;
    existing.minTime = Math.min(existing.minTime, duration);
    existing.maxTime = Math.max(existing.maxTime, duration);
    existing.lastRequestAt = new Date().toISOString();

    if (statusCode >= 400) {
      existing.errorCount++;
    } else {
      existing.successCount++;
    }

    this.metrics.set(key, existing);

    // Update request counts (for rate calculation)
    const now = Math.floor(Date.now() / 1000);
    const countKey = `requests:${now}`;
    const currentCount = this.requestCounts.get(countKey) || 0;
    this.requestCounts.set(countKey, currentCount + 1);

    // Clean up old request counts (keep last 60 seconds)
    this.cleanupOldCounts(now);

    // Update error counts
    if (statusCode >= 400) {
      const errorKey = `errors:${now}`;
      const currentErrors = this.errorCounts.get(errorKey) || 0;
      this.errorCounts.set(errorKey, currentErrors + 1);
    }
  }

  /**
   * Get metrics for a specific endpoint
   */
  getEndpointMetrics(method: string, endpoint: string): PerformanceMetrics | null {
    const key = `${method}:${endpoint}`;
    return this.metrics.get(key) || null;
  }

  /**
   * Get all endpoint metrics
   */
  getAllMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get top slowest endpoints
   */
  getSlowestEndpoints(limit: number = 10): PerformanceMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, limit);
  }

  /**
   * Get top most requested endpoints
   */
  getMostRequestedEndpoints(limit: number = 10): PerformanceMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Calculate requests per second (last 60 seconds)
    const now = Math.floor(Date.now() / 1000);
    let totalRequests = 0;
    let totalErrors = 0;
    
    for (let i = 0; i < 60; i++) {
      const key = `requests:${now - i}`;
      totalRequests += this.requestCounts.get(key) || 0;
      
      const errorKey = `errors:${now - i}`;
      totalErrors += this.errorCounts.get(errorKey) || 0;
    }

    const requestsPerSecond = totalRequests / 60;
    const successRate = totalRequests > 0 
      ? ((totalRequests - totalErrors) / totalRequests) * 100 
      : 100;

    // Get cache stats (if available)
    const cacheStats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
    };

    try {
      // Try to get cache stats from cacheService if available
      // This will be populated by the cache middleware
    } catch (error) {
      // Cache service not available
    }

    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: memoryPercentage,
      },
      cpu: {
        usage: 0, // CPU usage requires additional monitoring tools
      },
      requests: {
        total: totalRequests,
        perSecond: requestsPerSecond,
        errors: totalErrors,
        successRate,
      },
      cache: cacheStats,
      database: {
        queryCount: 0, // Would need database query tracking
        averageQueryTime: 0,
      },
    };
  }

  /**
   * Clean up old request counts
   */
  private cleanupOldCounts(currentSecond: number): void {
    const keysToDelete: string[] = [];
    
    for (const [key] of this.requestCounts) {
      const timestamp = parseInt(key.split(':')[1], 10);
      if (currentSecond - timestamp > 60) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.requestCounts.delete(key);
    }

    // Clean up error counts too
    for (const [key] of this.errorCounts) {
      const timestamp = parseInt(key.split(':')[1], 10);
      if (currentSecond - timestamp > 60) {
        this.errorCounts.delete(key);
      }
    }
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics.clear();
    this.requestCounts.clear();
    this.errorCounts.clear();
    this.startTime = Date.now();
  }

  /**
   * Get uptime
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

export const performanceMonitoring = new PerformanceMonitoringService();

/**
 * Middleware to track request performance
 */
export function performanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const method = req.method;
  const endpoint = req.path;

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function (chunk?: unknown, encoding?: unknown) {
    const duration = Date.now() - startTime;
    performanceMonitoring.recordRequest(method, endpoint, duration, res.statusCode);
    originalEnd.call(this, chunk, encoding);
  };

  next();
}

