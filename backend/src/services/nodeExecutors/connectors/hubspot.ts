/**
 * HubSpot Connector Executor
 * 
 * Executes HubSpot connector actions using the HubSpot REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface HubSpotCredentials {
  access_token: string;
  refresh_token?: string;
}

/**
 * Create HubSpot API client
 */
function createHubSpotClient(credentials: HubSpotCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.hubapi.com',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a contact in HubSpot
 */
export async function executeHubSpotCreateContact(
  email: string,
  firstName?: string,
  lastName?: string,
  credentials: HubSpotCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createHubSpotClient(credentials);
    const properties: Record<string, string> = {
      email,
    };
    
    if (firstName) properties.firstname = firstName;
    if (lastName) properties.lastname = lastName;

    const response = await client.post('/crm/v3/objects/contacts', {
      properties,
    });

    return {
      success: true,
      output: {
        id: response.data.id,
        properties: response.data.properties,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'HubSpot create contact failed',
        code: 'HUBSPOT_CREATE_CONTACT_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get a contact from HubSpot
 */
export async function executeHubSpotGetContact(
  contactId?: string,
  email?: string,
  credentials: HubSpotCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createHubSpotClient(credentials);
    
    let response;
    if (contactId) {
      response = await client.get(`/crm/v3/objects/contacts/${contactId}`);
    } else if (email) {
      response = await client.get('/crm/v3/objects/contacts/search', {
        params: {
          filterGroups: [{
            filters: [{
              propertyName: 'email',
              operator: 'EQ',
              value: email,
            }],
          }],
        },
      });
      // Extract first result if found
      if (response.data.results && response.data.results.length > 0) {
        response.data = response.data.results[0];
      } else {
        return {
          success: false,
          error: {
            message: 'Contact not found',
            code: 'CONTACT_NOT_FOUND',
          },
        };
      }
    } else {
      return {
        success: false,
        error: {
          message: 'Either contactId or email is required',
          code: 'MISSING_PARAMETERS',
        },
      };
    }

    return {
      success: true,
      output: {
        contact: response.data,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'HubSpot get contact failed',
        code: 'HUBSPOT_GET_CONTACT_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute HubSpot connector action
 */
export async function executeHubSpot(
  actionId: string,
  input: Record<string, unknown>,
  credentials: HubSpotCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_contact':
      const email = input.email as string;
      if (!email) {
        return {
          success: false,
          error: {
            message: 'Email is required',
            code: 'MISSING_EMAIL',
          },
        };
      }
      return executeHubSpotCreateContact(
        email,
        input.firstName as string | undefined,
        input.lastName as string | undefined,
        credentials
      );

    case 'get_contact':
      return executeHubSpotGetContact(
        input.contactId as string | undefined,
        input.email as string | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown HubSpot action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

