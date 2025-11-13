/**
 * MySQL Connector Executor
 * 
 * Executes MySQL connector actions using direct database connection
 */

import { createConnection, Connection, QueryResult } from 'mysql2/promise';
import { NodeExecutionResult } from '@sos/shared';

interface MySQLCredentials {
  connection_string?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

/**
 * Create MySQL connection
 */
async function createMySQLConnection(credentials: MySQLCredentials): Promise<Connection> {
  if (credentials.connection_string) {
    // Parse connection string (format: mysql://user:password@host:port/database)
    const url = new URL(credentials.connection_string);
    return createConnection({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      database: url.pathname.slice(1),
      user: url.username,
      password: url.password,
      ssl: credentials.ssl,
    });
  }

  return createConnection({
    host: credentials.host || 'localhost',
    port: credentials.port || 3306,
    database: credentials.database || 'mysql',
    user: credentials.user,
    password: credentials.password,
    ssl: credentials.ssl,
  });
}

/**
 * Execute SQL query on MySQL
 */
export async function executeMySQLQuery(
  query: string,
  params?: unknown[],
  credentials: MySQLCredentials
): Promise<NodeExecutionResult> {
  let connection: Connection | null = null;
  
  try {
    connection = await createMySQLConnection(credentials);
    const [rows, fields] = await connection.execute(query, params || []);

    return {
      success: true,
      output: {
        rows: Array.isArray(rows) ? rows : [],
        affectedRows: (rows as any).affectedRows || 0,
        fields: fields?.map(f => ({
          name: f.name,
          type: f.type,
        })) || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'MySQL query failed',
        code: 'MYSQL_QUERY_ERROR',
        details: {
          code: error.code,
          errno: error.errno,
        },
      },
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * List tables in MySQL
 */
export async function executeMySQLListTables(
  database?: string,
  credentials: MySQLCredentials
): Promise<NodeExecutionResult> {
  let connection: Connection | null = null;
  
  try {
    connection = await createMySQLConnection(credentials);
    const dbName = database || credentials.database || 'mysql';
    const query = `SHOW TABLES FROM \`${dbName}\``;
    
    const [rows] = await connection.execute(query);

    return {
      success: true,
      output: {
        tables: Array.isArray(rows) ? rows.map((row: any) => ({
          name: Object.values(row)[0] as string,
        })) : [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'MySQL list tables failed',
        code: 'MYSQL_LIST_TABLES_ERROR',
        details: {
          code: error.code,
        },
      },
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Execute MySQL connector action
 */
export async function executeMySQL(
  actionId: string,
  input: Record<string, unknown>,
  credentials: MySQLCredentials
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
      return executeMySQLQuery(
        query,
        input.params as unknown[] | undefined,
        credentials
      );

    case 'list_tables':
      return executeMySQLListTables(
        input.database as string | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown MySQL action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

