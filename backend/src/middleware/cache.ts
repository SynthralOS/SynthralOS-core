import { Request, Response, NextFunction } from 'express';
import { cacheService, CacheOptions } from '../services/cacheService';

/**
 * Cache middleware for GET requests
 */
export function cacheMiddleware(options?: CacheOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    const prefix = options?.prefix || 'api';

    try {
      // Try to get from cache
      const cached = await cacheService.get(cacheKey, prefix);
      
      if (cached) {
        return res.json(cached);
      }

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      let responseCached = false;
      res.json = function (body: unknown) {
        // Only cache successful responses (2xx status codes)
        if (!responseCached && res.statusCode >= 200 && res.statusCode < 300) {
          responseCached = true;
          // Cache the response
          cacheService.set(cacheKey, body, {
            ...options,
            prefix,
          }).catch((err) => {
            console.error('Cache set error:', err);
          });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Invalidate cache for a specific pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  await cacheService.deleteByPattern(pattern);
}

/**
 * Invalidate cache for a specific endpoint
 */
export async function invalidateEndpointCache(
  method: string,
  path: string,
  prefix: string = 'api'
): Promise<void> {
  const pattern = `${prefix}:${method}:${path}*`;
  await cacheService.deleteByPattern(pattern);
}

