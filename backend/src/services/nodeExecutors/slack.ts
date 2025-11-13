import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import axios from 'axios';

export async function executeSlack(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const webhookUrl = (nodeConfig.webhookUrl as string) || process.env.SLACK_WEBHOOK_URL || '';
  const message = (input.message as string) || '';
  const channel = (input.channel as string) || (nodeConfig.channel as string) || '';
  const username = (nodeConfig.username as string) || 'SynthralOS Bot';
  const iconEmoji = (nodeConfig.iconEmoji as string) || ':robot_face:';

  if (!webhookUrl) {
    return {
      success: false,
      error: {
        message: 'Slack webhook URL is required',
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
      text: message,
      username,
      icon_emoji: iconEmoji,
    };

    if (channel) {
      payload.channel = channel;
    }

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      output: {
        ts: response.data.ts || 'unknown',
        success: true,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data || error.message || 'Slack message send failed',
        code: 'SLACK_ERROR',
        details: error.response?.data || error,
      },
    };
  }
}

