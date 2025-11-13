/**
 * PayPal Connector Executor
 * 
 * Executes PayPal connector actions using the PayPal REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface PayPalCredentials {
  client_id: string;
  client_secret: string;
  mode?: 'sandbox' | 'live';
}

/**
 * Get PayPal access token
 */
async function getPayPalAccessToken(credentials: PayPalCredentials): Promise<string> {
  const baseUrl = credentials.mode === 'live' 
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  const auth = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64');
  
  const response = await axios.post(
    `${baseUrl}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
}

/**
 * Create PayPal API client
 */
async function createPayPalClient(credentials: PayPalCredentials): Promise<AxiosInstance> {
  const accessToken = await getPayPalAccessToken(credentials);
  const baseUrl = credentials.mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  return axios.create({
    baseURL: baseUrl,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a payment in PayPal
 */
export async function executePayPalCreatePayment(
  amount: number,
  currency: string,
  description?: string,
  returnUrl?: string,
  cancelUrl?: string,
  credentials: PayPalCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = await createPayPalClient(credentials);
    
    const paymentData = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal',
      },
      transactions: [
        {
          amount: {
            total: amount.toFixed(2),
            currency: currency.toUpperCase(),
          },
          description: description || 'Payment',
        },
      ],
      redirect_urls: {
        return_url: returnUrl || 'https://example.com/return',
        cancel_url: cancelUrl || 'https://example.com/cancel',
      },
    };

    const response = await client.post('/v1/payments/payment', paymentData);

    // Extract approval URL
    const approvalUrl = response.data.links?.find((link: any) => link.rel === 'approval_url')?.href;

    return {
      success: true,
      output: {
        id: response.data.id,
        state: response.data.state,
        approval_url: approvalUrl,
        payment: response.data,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'PayPal create payment failed',
        code: 'PAYPAL_CREATE_PAYMENT_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute PayPal connector action
 */
export async function executePayPal(
  actionId: string,
  input: Record<string, unknown>,
  credentials: PayPalCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_payment':
      const amount = input.amount as number;
      const currency = input.currency as string || 'USD';
      
      if (!amount) {
        return {
          success: false,
          error: {
            message: 'amount is required',
            code: 'MISSING_AMOUNT',
          },
        };
      }
      return executePayPalCreatePayment(
        amount,
        currency,
        input.description as string | undefined,
        input.returnUrl as string | undefined,
        input.cancelUrl as string | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown PayPal action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

