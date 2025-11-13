/**
 * Twilio Connector Executor
 * 
 * Executes Twilio connector actions using the Twilio REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface TwilioCredentials {
  account_sid: string;
  auth_token: string;
}

/**
 * Create Twilio API client
 */
function createTwilioClient(credentials: TwilioCredentials): AxiosInstance {
  const auth = Buffer.from(`${credentials.account_sid}:${credentials.auth_token}`).toString('base64');
  
  return axios.create({
    baseURL: 'https://api.twilio.com/2010-04-01',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    auth: {
      username: credentials.account_sid,
      password: credentials.auth_token,
    },
  });
}

/**
 * Send SMS via Twilio
 */
export async function executeTwilioSendSMS(
  to: string,
  from: string,
  body: string,
  credentials: TwilioCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createTwilioClient(credentials);
    const params = new URLSearchParams({
      To: to,
      From: from,
      Body: body,
    });

    const response = await client.post(`/Accounts/${credentials.account_sid}/Messages.json`, params);

    return {
      success: true,
      output: {
        sid: response.data.sid,
        status: response.data.status,
        dateCreated: response.data.date_created,
        dateSent: response.data.date_sent,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Twilio SMS send failed',
        code: 'TWILIO_SMS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Make a phone call via Twilio
 */
export async function executeTwilioMakeCall(
  to: string,
  from: string,
  url: string,
  credentials: TwilioCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createTwilioClient(credentials);
    const params = new URLSearchParams({
      To: to,
      From: from,
      Url: url,
    });

    const response = await client.post(`/Accounts/${credentials.account_sid}/Calls.json`, params);

    return {
      success: true,
      output: {
        sid: response.data.sid,
        status: response.data.status,
        dateCreated: response.data.date_created,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Twilio call failed',
        code: 'TWILIO_CALL_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Twilio connector action
 */
export async function executeTwilio(
  actionId: string,
  input: Record<string, unknown>,
  credentials: TwilioCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'send_sms':
      const to = input.to as string;
      const from = input.from as string;
      const body = input.body as string;
      
      if (!to || !from || !body) {
        return {
          success: false,
          error: {
            message: 'to, from, and body are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeTwilioSendSMS(to, from, body, credentials);

    case 'make_call':
      const callTo = input.to as string;
      const callFrom = input.from as string;
      const callUrl = input.url as string;
      
      if (!callTo || !callFrom || !callUrl) {
        return {
          success: false,
          error: {
            message: 'to, from, and url are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeTwilioMakeCall(callTo, callFrom, callUrl, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Twilio action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

