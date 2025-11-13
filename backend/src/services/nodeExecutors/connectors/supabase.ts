/**
 * Supabase Connector Executor
 * 
 * Executes Supabase connector actions using the Supabase REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface SupabaseCredentials {
  api_key: string;
  url: string;
}

/**
 * Create Supabase API client
 */
function createSupabaseClient(credentials: SupabaseCredentials): AxiosInstance {
  return axios.create({
    baseURL: `${credentials.url}/rest/v1`,
    headers: {
      'apikey': credentials.api_key,
      'Authorization': `Bearer ${credentials.api_key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  });
}

/**
 * Query a Supabase table
 */
export async function executeSupabaseQuery(
  table: string,
  select?: string,
  filter?: Record<string, unknown>,
  limit?: number,
  credentials: SupabaseCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createSupabaseClient(credentials);
    const params: Record<string, unknown> = {};
    
    if (select) params.select = select;
    if (limit) params.limit = limit;
    
    // Build filter query string (simplified - in production, use PostgREST query syntax)
    let url = `/${table}`;
    if (select) {
      url += `?select=${select}`;
    }
    if (limit) {
      url += `${select ? '&' : '?'}limit=${limit}`;
    }

    const response = await client.get(url, { params: filter });

    return {
      success: true,
      output: {
        data: response.data || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Supabase query failed',
        code: 'SUPABASE_QUERY_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Insert row into Supabase table
 */
export async function executeSupabaseInsert(
  table: string,
  data: Record<string, unknown>,
  credentials: SupabaseCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createSupabaseClient(credentials);
    const response = await client.post(`/${table}`, data);

    return {
      success: true,
      output: {
        data: Array.isArray(response.data) ? response.data : [response.data],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Supabase insert failed',
        code: 'SUPABASE_INSERT_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Supabase connector action
 */
export async function executeSupabase(
  actionId: string,
  input: Record<string, unknown>,
  credentials: SupabaseCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'query':
      const table = input.table as string;
      if (!table) {
        return {
          success: false,
          error: {
            message: 'Table is required',
            code: 'MISSING_TABLE',
          },
        };
      }
      return executeSupabaseQuery(
        table,
        input.select as string | undefined,
        input.filter as Record<string, unknown> | undefined,
        input.limit as number | undefined,
        credentials
      );

    case 'insert':
      const insertTable = input.table as string;
      const insertData = input.data as Record<string, unknown>;
      
      if (!insertTable || !insertData) {
        return {
          success: false,
          error: {
            message: 'Table and data are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeSupabaseInsert(insertTable, insertData, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Supabase action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

