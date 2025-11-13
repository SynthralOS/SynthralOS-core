/**
 * Salesforce Connector Executor
 * 
 * Executes Salesforce connector actions using the Salesforce REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface SalesforceCredentials {
  access_token: string;
  instance_url?: string;
  refresh_token?: string;
}

/**
 * Create Salesforce API client
 */
function createSalesforceClient(credentials: SalesforceCredentials): AxiosInstance {
  const instanceUrl = credentials.instance_url || 'https://login.salesforce.com';
  
  return axios.create({
    baseURL: `${instanceUrl}/services/data/v58.0`,
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Execute Salesforce SOQL query
 */
export async function executeSalesforceQuery(
  query: string,
  credentials: SalesforceCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createSalesforceClient(credentials);
    const response = await client.get('/query', {
      params: { q: query },
    });

    return {
      success: true,
      output: {
        records: response.data.records || [],
        totalSize: response.data.totalSize || 0,
        done: response.data.done || false,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Salesforce query failed',
        code: 'SALESFORCE_QUERY_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Create a record in Salesforce
 */
export async function executeSalesforceCreateRecord(
  objectType: string,
  fields: Record<string, unknown>,
  credentials: SalesforceCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createSalesforceClient(credentials);
    const response = await client.post(`/sobjects/${objectType}`, fields);

    return {
      success: true,
      output: {
        id: response.data.id,
        success: response.data.success || true,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.[0]?.message || error.message || 'Salesforce create failed',
        code: 'SALESFORCE_CREATE_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Salesforce connector action
 */
export async function executeSalesforce(
  actionId: string,
  input: Record<string, unknown>,
  credentials: SalesforceCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'query':
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
      return executeSalesforceQuery(query, credentials);

    case 'create_record':
      const objectType = input.objectType as string;
      const fields = input.fields as Record<string, unknown>;
      if (!objectType || !fields) {
        return {
          success: false,
          error: {
            message: 'objectType and fields are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeSalesforceCreateRecord(objectType, fields, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Salesforce action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

