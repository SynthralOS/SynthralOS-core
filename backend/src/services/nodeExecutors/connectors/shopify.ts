/**
 * Shopify Connector Executor
 * 
 * Executes Shopify connector actions using the Shopify REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface ShopifyCredentials {
  access_token: string;
  shop?: string; // Shop domain (e.g., 'myshop.myshopify.com')
}

/**
 * Create Shopify API client
 */
function createShopifyClient(credentials: ShopifyCredentials): AxiosInstance {
  const shop = credentials.shop || process.env.SHOPIFY_SHOP || '';
  
  if (!shop) {
    throw new Error('Shopify shop domain is required');
  }
  
  // Remove 'https://' and trailing slash if present
  const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  return axios.create({
    baseURL: `https://${cleanShop}/admin/api/2024-01`,
    headers: {
      'X-Shopify-Access-Token': credentials.access_token,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Get products from Shopify store
 */
export async function executeShopifyGetProducts(
  limit?: number,
  credentials: ShopifyCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createShopifyClient(credentials);
    
    const params: Record<string, unknown> = {};
    if (limit) {
      params.limit = limit;
    }

    const response = await client.get('/products.json', { params });

    return {
      success: true,
      output: {
        products: response.data.products || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.errors || error.message || 'Shopify get products failed',
        code: 'SHOPIFY_GET_PRODUCTS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Create a product in Shopify
 */
export async function executeShopifyCreateProduct(
  title: string,
  bodyHtml?: string,
  vendor?: string,
  productType?: string,
  credentials: ShopifyCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createShopifyClient(credentials);
    
    const productData: Record<string, unknown> = {
      title,
    };
    
    if (bodyHtml) {
      productData.body_html = bodyHtml;
    }
    if (vendor) {
      productData.vendor = vendor;
    }
    if (productType) {
      productData.product_type = productType;
    }

    const response = await client.post('/products.json', {
      product: productData,
    });

    return {
      success: true,
      output: {
        id: response.data.product.id,
        title: response.data.product.title,
        handle: response.data.product.handle,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.errors || error.message || 'Shopify product creation failed',
        code: 'SHOPIFY_CREATE_PRODUCT_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Shopify connector action
 */
export async function executeShopify(
  actionId: string,
  input: Record<string, unknown>,
  credentials: ShopifyCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'get_products':
      const limit = input.limit as number | undefined;
      return executeShopifyGetProducts(limit, credentials);

    case 'create_product':
      const title = input.title as string;
      const bodyHtml = input.body_html as string | undefined;
      const vendor = input.vendor as string | undefined;
      const productType = input.product_type as string | undefined;
      
      if (!title) {
        return {
          success: false,
          error: {
            message: 'title is required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeShopifyCreateProduct(title, bodyHtml, vendor, productType, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Shopify action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

