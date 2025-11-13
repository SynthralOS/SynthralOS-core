/**
 * PostgreSQL Connector Executor
 * 
 * Executes PostgreSQL connector actions using direct database connection
 */

import { Pool, QueryResult } from 'pg';
import { NodeExecutionResult } from '@sos/shared';

interface PostgreSQLCredentials {
  connection_string: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

/**
 * Create PostgreSQL connection pool
 */
function createPostgreSQLPool(credentials: PostgreSQLCredentials): Pool {
  if (credentials.connection_string) {
    return new Pool({
      connectionString: credentials.connection_string,
    });
  }

  return new Pool({
    host: credentials.host || 'localhost',
    port: credentials.port || 5432,
    database: credentials.database || 'postgres',
    user: credentials.user,
    password: credentials.password,
    ssl: credentials.ssl ? { rejectUnauthorized: false } : false,
  });
}

/**
 * Execute SQL query on PostgreSQL
 */
export async function executePostgreSQLQuery(
  query: string,
  params?: unknown[],
  credentials: PostgreSQLCredentials
): Promise<NodeExecutionResult> {
  const pool = createPostgreSQLPool(credentials);
  
  try {
    const result: QueryResult = await pool.query(query, params);

    return {
      success: true,
      output: {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        fields: result.fields.map(f => ({
          name: f.name,
          dataTypeID: f.dataTypeID,
        })),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'PostgreSQL query failed',
        code: 'POSTGRESQL_QUERY_ERROR',
        details: {
          code: error.code,
          detail: error.detail,
        },
      },
    };
  } finally {
    await pool.end();
  }
}

/**
 * List tables in PostgreSQL
 */
export async function executePostgreSQLListTables(
  schema: string = 'public',
  credentials: PostgreSQLCredentials
): Promise<NodeExecutionResult> {
  const pool = createPostgreSQLPool(credentials);
  
  try {
    const query = `
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema = $1
      ORDER BY table_name;
    `;
    
    const result = await pool.query(query, [schema]);

    return {
      success: true,
      output: {
        tables: result.rows.map(row => ({
          name: row.table_name,
          schema: row.table_schema,
        })),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'PostgreSQL list tables failed',
        code: 'POSTGRESQL_LIST_TABLES_ERROR',
        details: {
          code: error.code,
        },
      },
    };
  } finally {
    await pool.end();
  }
}

/**
 * Execute PostgreSQL connector action
 */
export async function executePostgreSQL(
  actionId: string,
  input: Record<string, unknown>,
  credentials: PostgreSQLCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'execute_query':
      const query = input.query as string;
      if (!query) {
        return {
          success: false,
          error: {
            message: 'Query is required',
            code: 'MISSING_QUERY',
          },
        };
      }
      return executePostgreSQLQuery(
        query,
        input.params as unknown[] | undefined,
        credentials
      );

    case 'list_tables':
      return executePostgreSQLListTables(
        input.schema as string | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown PostgreSQL action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

