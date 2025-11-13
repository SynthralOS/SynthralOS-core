import axios, { AxiosRequestConfig } from 'axios';
import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';

export async function executeHttpRequest(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  // Get URL from input or config
  const url = (input.url as string) || nodeConfig.url || '';
  if (!url) {
    return {
      success: false,
      error: {
        message: 'URL is required for HTTP request',
        code: 'MISSING_URL',
      },
    };
  }

  // Build request config
  const method = (input.method as string) || nodeConfig.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...(input.headers as Record<string, string>),
    ...(nodeConfig.headers as Record<string, string>),
  };

  const requestConfig: AxiosRequestConfig = {
    method: method as any,
    url,
    headers,
    timeout: nodeConfig.timeout || 30000,
    maxRedirects: nodeConfig.followRedirects !== false ? 5 : 0,
  };

  // Add body for methods that support it
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    requestConfig.data = input.body || nodeConfig.body || {};
  }

  try {
    const response = await axios(requestConfig);

    return {
      success: true,
      output: {
        status: response.status,
        headers: response.headers,
        data: response.data,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'HTTP request failed',
        code: error.code || 'HTTP_ERROR',
        details: {
          status: error.response?.status,
          data: error.response?.data,
        },
      },
    };
  }
}

