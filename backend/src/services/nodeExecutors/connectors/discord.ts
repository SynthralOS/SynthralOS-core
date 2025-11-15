/**
 * Discord Connector Executor
 * 
 * Executes Discord connector actions using the Discord REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface DiscordCredentials {
  access_token: string;
  bot_token?: string; // Bot token for bot-based authentication
}

/**
 * Create Discord API client
 */
function createDiscordClient(credentials: DiscordCredentials): AxiosInstance {
  // Use bot token if available, otherwise use OAuth access token
  const token = credentials.bot_token || credentials.access_token;
  const tokenType = credentials.bot_token ? 'Bot' : 'Bearer';
  
  return axios.create({
    baseURL: 'https://discord.com/api/v10',
    headers: {
      'Authorization': `${tokenType} ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Send message to Discord channel
 */
export async function executeDiscordSendMessage(
  channelId: string,
  content: string,
  credentials: DiscordCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createDiscordClient(credentials);
    
    const messageData = {
      content,
    };

    const response = await client.post(`/channels/${channelId}/messages`, messageData);

    return {
      success: true,
      output: {
        id: response.data.id,
        channel_id: response.data.channel_id,
        content: response.data.content,
        timestamp: response.data.timestamp,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Discord message send failed',
        code: 'DISCORD_MESSAGE_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Discord connector action
 */
export async function executeDiscord(
  actionId: string,
  input: Record<string, unknown>,
  credentials: DiscordCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'send_message':
      const channelId = input.channelId as string;
      const content = input.content as string;
      
      if (!channelId || !content) {
        return {
          success: false,
          error: {
            message: 'channelId and content are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeDiscordSendMessage(channelId, content, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Discord action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

