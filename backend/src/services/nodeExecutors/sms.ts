import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import axios from 'axios';

export async function executeSMS(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const provider = (nodeConfig.provider as string) || 'twilio';
  const to = (input.to as string) || (nodeConfig.to as string) || '';
  const message = (input.message as string) || '';
  const from = (nodeConfig.from as string) || '';
  const accountSid = (nodeConfig.accountSid as string) || process.env.TWILIO_ACCOUNT_SID || '';
  const authToken = (nodeConfig.authToken as string) || process.env.TWILIO_AUTH_TOKEN || '';

  if (!to || !message) {
    return {
      success: false,
      error: {
        message: 'Recipient (to) and message are required',
        code: 'MISSING_REQUIRED_FIELDS',
      },
    };
  }

  try {
    if (provider === 'twilio') {
      if (!accountSid || !authToken || !from) {
        return {
          success: false,
          error: {
            message: 'Twilio Account SID, Auth Token, and From number are required',
            code: 'MISSING_CREDENTIALS',
          },
        };
      }

      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        new URLSearchParams({
          From: from,
          To: to,
          Body: message,
        }),
        {
          auth: {
            username: accountSid,
            password: authToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return {
        success: true,
        output: {
          sid: response.data.sid || 'unknown',
          success: true,
        },
      };
    } else if (provider === 'vonage') {
      // Vonage (Nexmo) support would require vonage package
      return {
        success: false,
        error: {
          message: 'Vonage support requires @vonage/server-sdk package',
          code: 'VONAGE_NOT_AVAILABLE',
        },
      };
    } else if (provider === 'aws-sns') {
      // AWS SNS would require AWS SDK
      return {
        success: false,
        error: {
          message: 'AWS SNS support requires @aws-sdk/client-sns package',
          code: 'SNS_NOT_AVAILABLE',
        },
      };
    } else {
      return {
        success: false,
        error: {
          message: `Unsupported SMS provider: ${provider}`,
          code: 'UNSUPPORTED_PROVIDER',
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'SMS send failed',
        code: 'SMS_ERROR',
        details: error.response?.data || error,
      },
    };
  }
}

