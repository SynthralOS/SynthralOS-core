/**
 * Zoho CRM Connector Executor
 * 
 * Executes Zoho CRM connector actions using the Zoho CRM REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface ZohoCredentials {
  access_token: string;
  api_domain?: string; // e.g., 'www.zohoapis.com' or 'www.zohoapis.eu'
}

/**
 * Create Zoho CRM API client
 */
function createZohoClient(credentials: ZohoCredentials): AxiosInstance {
  const apiDomain = credentials.api_domain || 'www.zohoapis.com';
  
  return axios.create({
    baseURL: `https://${apiDomain}/crm/v3`,
    headers: {
      'Authorization': `Zoho-oauthtoken ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a lead in Zoho CRM
 */
export async function executeZohoCreateLead(
  lastName: string,
  firstName?: string,
  email?: string,
  company?: string,
  phone?: string,
  credentials: ZohoCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createZohoClient(credentials);
    const data: Record<string, unknown> = {
      Last_Name: lastName,
    };
    
    if (firstName) data.First_Name = firstName;
    if (email) data.Email = email;
    if (company) data.Company = company;
    if (phone) data.Phone = phone;

    const response = await client.post('/Leads', {
      data: [data],
    });

    return {
      success: true,
      output: {
        id: response.data.data?.[0]?.details?.id,
        ...response.data.data?.[0],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.data?.[0]?.message || error.message || 'Zoho CRM create lead failed',
        code: 'ZOHO_CREATE_LEAD_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get leads from Zoho CRM
 */
export async function executeZohoGetLeads(
  page?: number,
  perPage?: number,
  credentials: ZohoCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createZohoClient(credentials);
    const params: Record<string, unknown> = {};
    
    if (page) params.page = page;
    if (perPage) params.per_page = perPage;

    const response = await client.get('/Leads', { params });

    return {
      success: true,
      output: {
        leads: response.data.data || [],
        info: response.data.info,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.data?.[0]?.message || error.message || 'Zoho CRM get leads failed',
        code: 'ZOHO_GET_LEADS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Zoho CRM connector action
 */
export async function executeZoho(
  actionId: string,
  input: Record<string, unknown>,
  credentials: ZohoCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_lead':
      const lastName = input.Last_Name as string;
      if (!lastName) {
        return {
          success: false,
          error: {
            message: 'Last_Name is required',
            code: 'MISSING_LAST_NAME',
          },
        };
      }
      return executeZohoCreateLead(
        lastName,
        input.First_Name as string | undefined,
        input.Email as string | undefined,
        input.Company as string | undefined,
        input.Phone as string | undefined,
        credentials
      );

    case 'get_leads':
      return executeZohoGetLeads(
        input.page as number | undefined,
        input.per_page as number | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown Zoho CRM action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

