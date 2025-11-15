/**
 * Microsoft Teams Connector Executor
 * 
 * Executes Microsoft Teams connector actions using the Microsoft Graph API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface MicrosoftTeamsCredentials {
  access_token: string;
}

/**
 * Create Microsoft Graph API client
 */
function createMicrosoftGraphClient(credentials: MicrosoftTeamsCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://graph.microsoft.com/v1.0',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Send message to Microsoft Teams channel
 */
export async function executeMicrosoftTeamsSendMessage(
  teamId: string,
  channelId: string,
  message: string,
  credentials: MicrosoftTeamsCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createMicrosoftGraphClient(credentials);
    
    const messageData = {
      body: {
        contentType: 'text',
        content: message,
      },
    };

    const response = await client.post(
      `/teams/${teamId}/channels/${channelId}/messages`,
      messageData
    );

    return {
      success: true,
      output: {
        id: response.data.id,
        createdDateTime: response.data.createdDateTime,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Microsoft Teams message send failed',
        code: 'MICROSOFT_TEAMS_MESSAGE_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Microsoft Teams connector action
 */
export async function executeMicrosoftTeams(
  actionId: string,
  input: Record<string, unknown>,
  credentials: MicrosoftTeamsCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'send_message':
      const teamId = input.teamId as string;
      const channelId = input.channelId as string;
      const message = input.message as string;
      
      if (!teamId || !channelId || !message) {
        return {
          success: false,
          error: {
            message: 'teamId, channelId, and message are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeMicrosoftTeamsSendMessage(teamId, channelId, message, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Microsoft Teams action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

