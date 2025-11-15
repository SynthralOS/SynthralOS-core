/**
 * Stripe Connector Executor
 * 
 * Executes Stripe connector actions using the Stripe REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface StripeCredentials {
  access_token: string;
  api_key?: string; // Legacy API key support
}

/**
 * Create Stripe API client
 */
function createStripeClient(credentials: StripeCredentials): AxiosInstance {
  // Use API key if available, otherwise use OAuth access token
  const apiKey = credentials.api_key || credentials.access_token;
  
  return axios.create({
    baseURL: 'https://api.stripe.com/v1',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
}

/**
 * Create a payment intent
 */
export async function executeStripeCreatePaymentIntent(
  amount: number,
  currency: string,
  customer?: string,
  credentials: StripeCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createStripeClient(credentials);
    
    const params = new URLSearchParams({
      amount: amount.toString(),
      currency: currency.toLowerCase(),
    });
    
    if (customer) {
      params.append('customer', customer);
    }

    const response = await client.post('/payment_intents', params);

    return {
      success: true,
      output: {
        id: response.data.id,
        client_secret: response.data.client_secret,
        amount: response.data.amount,
        currency: response.data.currency,
        status: response.data.status,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Stripe payment intent creation failed',
        code: 'STRIPE_PAYMENT_INTENT_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Create a customer
 */
export async function executeStripeCreateCustomer(
  email: string,
  name?: string,
  credentials: StripeCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createStripeClient(credentials);
    
    const params = new URLSearchParams({
      email,
    });
    
    if (name) {
      params.append('name', name);
    }

    const response = await client.post('/customers', params);

    return {
      success: true,
      output: {
        id: response.data.id,
        email: response.data.email,
        name: response.data.name,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Stripe customer creation failed',
        code: 'STRIPE_CUSTOMER_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Stripe connector action
 */
export async function executeStripe(
  actionId: string,
  input: Record<string, unknown>,
  credentials: StripeCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_payment':
    case 'create_payment_intent':
      const amount = input.amount as number;
      const currency = input.currency as string;
      const customer = input.customer as string | undefined;
      
      if (!amount || !currency) {
        return {
          success: false,
          error: {
            message: 'amount and currency are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeStripeCreatePaymentIntent(amount, currency, customer, credentials);

    case 'create_customer':
      const email = input.email as string;
      const name = input.name as string | undefined;
      
      if (!email) {
        return {
          success: false,
          error: {
            message: 'email is required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeStripeCreateCustomer(email, name, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Stripe action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

