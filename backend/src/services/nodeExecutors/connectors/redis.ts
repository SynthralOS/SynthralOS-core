/**
 * Redis Connector Executor
 * 
 * Executes Redis connector actions using direct database connection
 */

import { createClient, RedisClientType } from 'redis';
import { NodeExecutionResult } from '@sos/shared';

interface RedisCredentials {
  connection_string: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

/**
 * Create Redis client
 */
async function createRedisClient(credentials: RedisCredentials): Promise<RedisClientType> {
  let url: string;
  
  if (credentials.connection_string) {
    url = credentials.connection_string;
  } else {
    const host = credentials.host || 'localhost';
    const port = credentials.port || 6379;
    const password = credentials.password ? `:${credentials.password}@` : '';
    const db = credentials.db ? `/${credentials.db}` : '';
    url = `redis://${password}${host}:${port}${db}`;
  }

  const client = createClient({ url });
  await client.connect();
  
  return client as RedisClientType;
}

/**
 * Get value from Redis
 */
export async function executeRedisGet(
  key: string,
  credentials: RedisCredentials
): Promise<NodeExecutionResult> {
  let client: RedisClientType | null = null;
  
  try {
    client = await createRedisClient(credentials);
    const value = await client.get(key);

    return {
      success: true,
      output: {
        value: value || null,
        exists: value !== null,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Redis get failed',
        code: 'REDIS_GET_ERROR',
      },
    };
  } finally {
    if (client) {
      await client.quit();
    }
  }
}

/**
 * Set value in Redis
 */
export async function executeRedisSet(
  key: string,
  value: string,
  ttl?: number,
  credentials: RedisCredentials
): Promise<NodeExecutionResult> {
  let client: RedisClientType | null = null;
  
  try {
    client = await createRedisClient(credentials);
    
    if (ttl) {
      await client.setEx(key, ttl, value);
    } else {
      await client.set(key, value);
    }

    return {
      success: true,
      output: {
        success: true,
        key,
        ttl: ttl || -1, // -1 means no expiration
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Redis set failed',
        code: 'REDIS_SET_ERROR',
      },
    };
  } finally {
    if (client) {
      await client.quit();
    }
  }
}

/**
 * Execute Redis connector action
 */
export async function executeRedis(
  actionId: string,
  input: Record<string, unknown>,
  credentials: RedisCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'get':
      const key = input.key as string;
      if (!key) {
        return {
          success: false,
          error: {
            message: 'Key is required',
            code: 'MISSING_KEY',
          },
        };
      }
      return executeRedisGet(key, credentials);

    case 'set':
      const setKey = input.key as string;
      const setValue = input.value as string;
      
      if (!setKey || !setValue) {
        return {
          success: false,
          error: {
            message: 'Key and value are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeRedisSet(
        setKey,
        setValue,
        input.ttl as number | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown Redis action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

