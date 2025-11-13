import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import postgres from 'postgres';

export async function executeDatabase(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const databaseType = (nodeConfig.databaseType as string) || 'postgresql';
  const connectionString = (nodeConfig.connectionString as string) || process.env.DATABASE_URL || '';
  const query = (input.query as string) || (nodeConfig.query as string) || '';
  const params = (input.params as Record<string, unknown>) || {};
  const operation = (nodeConfig.operation as string) || 'query';

  if (!query) {
    return {
      success: false,
      error: {
        message: 'SQL query is required',
        code: 'MISSING_QUERY',
      },
    };
  }

  if (!connectionString && !process.env.DATABASE_URL) {
    return {
      success: false,
      error: {
        message: 'Database connection string is required',
        code: 'MISSING_CONNECTION_STRING',
      },
    };
  }

  const connStr = connectionString || process.env.DATABASE_URL!;

  try {
    let results: unknown[];
    let rowCount = 0;

    if (databaseType === 'postgresql') {
      const sql = postgres(connStr, { max: 1 });
      try {
        if (operation === 'query' || operation === 'select') {
          results = await sql.unsafe(query, Object.values(params));
          rowCount = Array.isArray(results) ? results.length : 0;
        } else {
          // For INSERT, UPDATE, DELETE
          const result = await sql.unsafe(query, Object.values(params));
          results = [];
          rowCount = (result as any).count || 0;
        }
      } finally {
        await sql.end();
      }
    } else if (databaseType === 'mysql') {
      // MySQL support requires mysql2 package - for now return error
      return {
        success: false,
        error: {
          message: 'MySQL support requires mysql2 package. Please install it: npm install mysql2',
          code: 'MYSQL_NOT_AVAILABLE',
        },
      };
    } else if (databaseType === 'mongodb') {
      // MongoDB support requires mongodb package - for now return error
      return {
        success: false,
        error: {
          message: 'MongoDB support requires mongodb package. Please install it: npm install mongodb',
          code: 'MONGODB_NOT_AVAILABLE',
        },
      };
    } else {
      return {
        success: false,
        error: {
          message: `Unsupported database type: ${databaseType}. Supported: postgresql`,
          code: 'UNSUPPORTED_DATABASE_TYPE',
        },
      };
    }

    return {
      success: true,
      output: {
        results,
        rowCount,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Database query failed',
        code: 'DATABASE_ERROR',
        details: error,
      },
    };
  }
}

