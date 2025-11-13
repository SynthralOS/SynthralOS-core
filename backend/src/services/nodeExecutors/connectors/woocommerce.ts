/**
 * WooCommerce Connector Executor
 * 
 * Executes WooCommerce connector actions using the WooCommerce REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface WooCommerceCredentials {
  consumer_key: string;
  consumer_secret: string;
  store_url: string; // e.g., 'https://your-store.com'
}

/**
 * Create WooCommerce API client
 */
function createWooCommerceClient(credentials: WooCommerceCredentials): AxiosInstance {
  return axios.create({
    baseURL: `${credentials.store_url}/wp-json/wc/v3`,
    auth: {
      username: credentials.consumer_key,
      password: credentials.consumer_secret,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Get products from WooCommerce
 */
export async function executeWooCommerceGetProducts(
  perPage?: number,
  page?: number,
  status?: string,
  credentials: WooCommerceCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createWooCommerceClient(credentials);
    const params: Record<string, unknown> = {};
    
    if (perPage) params.per_page = perPage;
    if (page) params.page = page;
    if (status) params.status = status;

    const response = await client.get('/products', { params });

    return {
      success: true,
      output: {
        products: response.data || [],
        totalPages: parseInt(response.headers['x-wp-totalpages'] || '1'),
        total: parseInt(response.headers['x-wp-total'] || '0'),
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'WooCommerce get products failed',
        code: 'WOocommerce_GET_PRODUCTS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Create an order in WooCommerce
 */
export async function executeWooCommerceCreateOrder(
  lineItems: Array<{ product_id: number; quantity: number }>,
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    address_1?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  },
  shipping?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  },
  credentials: WooCommerceCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createWooCommerceClient(credentials);
    
    const orderData: Record<string, unknown> = {
      line_items: lineItems,
      billing,
      status: 'pending',
    };

    if (shipping) {
      orderData.shipping = shipping;
    }

    const response = await client.post('/orders', orderData);

    return {
      success: true,
      output: {
        id: response.data.id,
        order_key: response.data.order_key,
        status: response.data.status,
        total: response.data.total,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'WooCommerce create order failed',
        code: 'WOocommerce_CREATE_ORDER_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute WooCommerce connector action
 */
export async function executeWooCommerce(
  actionId: string,
  input: Record<string, unknown>,
  credentials: WooCommerceCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'get_products':
      return executeWooCommerceGetProducts(
        input.per_page as number | undefined,
        input.page as number | undefined,
        input.status as string | undefined,
        credentials
      );

    case 'create_order':
      const lineItems = input.line_items as Array<{ product_id: number; quantity: number }>;
      const billing = input.billing as {
        first_name: string;
        last_name: string;
        email: string;
        address_1?: string;
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
      };
      
      if (!lineItems || !billing) {
        return {
          success: false,
          error: {
            message: 'line_items and billing are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeWooCommerceCreateOrder(
        lineItems,
        billing,
        input.shipping as {
          first_name?: string;
          last_name?: string;
          address_1?: string;
          city?: string;
          state?: string;
          postcode?: string;
          country?: string;
        } | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown WooCommerce action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

