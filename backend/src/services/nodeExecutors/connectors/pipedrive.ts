/**
 * Pipedrive Connector Executor
 * 
 * Executes Pipedrive connector actions using the Pipedrive REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface PipedriveCredentials {
  access_token: string;
  api_domain?: string;
}

/**
 * Create Pipedrive API client
 */
function createPipedriveClient(credentials: PipedriveCredentials): AxiosInstance {
  const apiDomain = credentials.api_domain || 'api.pipedrive.com';
  
  return axios.create({
    baseURL: `https://${apiDomain}/v1`,
    params: {
      api_token: credentials.access_token,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a deal in Pipedrive
 */
export async function executePipedriveCreateDeal(
  title: string,
  value?: number,
  currency?: string,
  personId?: number,
  orgId?: number,
  credentials: PipedriveCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createPipedriveClient(credentials);
    const dealData: Record<string, unknown> = {
      title,
    };
    
    if (value !== undefined) dealData.value = value;
    if (currency) dealData.currency = currency;
    if (personId) dealData.person_id = personId;
    if (orgId) dealData.org_id = orgId;

    const response = await client.post('/deals', dealData);

    return {
      success: true,
      output: {
        id: response.data.data?.id,
        ...response.data.data,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error || error.message || 'Pipedrive create deal failed',
        code: 'PIPEDRIVE_CREATE_DEAL_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get deals from Pipedrive
 */
export async function executePipedriveGetDeals(
  limit?: number,
  start?: number,
  credentials: PipedriveCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createPipedriveClient(credentials);
    const params: Record<string, unknown> = {};
    
    if (limit) params.limit = limit;
    if (start) params.start = start;

    const response = await client.get('/deals', { params });

    return {
      success: true,
      output: {
        deals: response.data.data || [],
        additional_data: response.data.additional_data,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error || error.message || 'Pipedrive get deals failed',
        code: 'PIPEDRIVE_GET_DEALS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Pipedrive connector action
 */
export async function executePipedrive(
  actionId: string,
  input: Record<string, unknown>,
  credentials: PipedriveCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_deal':
      const title = input.title as string;
      if (!title) {
        return {
          success: false,
          error: {
            message: 'Title is required',
            code: 'MISSING_TITLE',
          },
        };
      }
      return executePipedriveCreateDeal(
        title,
        input.value as number | undefined,
        input.currency as string | undefined,
        input.personId as number | undefined,
        input.orgId as number | undefined,
        credentials
      );

    case 'get_deals':
      return executePipedriveGetDeals(
        input.limit as number | undefined,
        input.start as number | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown Pipedrive action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

