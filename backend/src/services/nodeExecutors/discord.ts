import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import axios from 'axios';

export async function executeDiscord(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const webhookUrl = (nodeConfig.webhookUrl as string) || process.env.DISCORD_WEBHOOK_URL || '';
  const message = (input.message as string) || '';
  const username = (nodeConfig.username as string) || 'SynthralOS Bot';
  const avatarUrl = (nodeConfig.avatarUrl as string) || '';

  if (!webhookUrl) {
    return {
      success: false,
      error: {
        message: 'Discord webhook URL is required',
        code: 'MISSING_WEBHOOK_URL',
      },
    };
  }

  if (!message) {
    return {
      success: false,
      error: {
        message: 'Message is required',
        code: 'MISSING_MESSAGE',
      },
    };
  }

  try {
    const payload: any = {
      content: message,
      username,
    };

    if (avatarUrl) {
      payload.avatar_url = avatarUrl;
    }

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      output: {
        id: response.data.id || 'unknown',
        success: true,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Discord message send failed',
        code: 'DISCORD_ERROR',
        details: error.response?.data || error,
      },
    };
  }
}

