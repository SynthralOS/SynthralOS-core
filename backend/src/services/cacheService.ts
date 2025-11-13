import redis from '../config/redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

class CacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };

  /**
   * Get value from cache
   */
  async get<T>(key: string, prefix?: string): Promise<T | null> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      const value = await redis.get(fullKey);
      
      if (value) {
        this.stats.hits++;
        this.updateHitRate();
        return JSON.parse(value) as T;
      }
      
      this.stats.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = options?.prefix ? `${options.prefix}:${key}` : key;
      const serialized = JSON.stringify(value);
      
      if (options?.ttl) {
        await redis.setex(fullKey, options.ttl, serialized);
      } else {
        await redis.set(fullKey, serialized);
      }
      
      this.stats.sets++;
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, prefix?: string): Promise<void> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      await redis.del(fullKey);
      this.stats.deletes++;
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        this.stats.deletes += keys.length;
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  /**
   * Invalidate cache for a specific prefix
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    await this.deleteByPattern(`${prefix}:*`);
  }

  /**
   * Check if key exists
   */
  async exists(key: string, prefix?: string): Promise<boolean> {
    try {
      const fullKey = prefix ? `${prefix}:${key}` : key;
      const result = await redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
    };
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Get cache size (approximate)
   */
  async getSize(): Promise<number> {
    try {
      const info = await redis.info('keyspace');
      // Parse keyspace info to get approximate key count
      const match = info.match(/keys=(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch (error) {
      console.error('Cache size error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      await redis.flushdb();
      this.stats.deletes = 0;
      this.stats.hits = 0;
      this.stats.misses = 0;
      this.stats.sets = 0;
      this.stats.hitRate = 0;
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

export const cacheService = new CacheService();

