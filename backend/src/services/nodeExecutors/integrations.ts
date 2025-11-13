import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import axios from 'axios';

// Google Sheets
export async function executeGoogleSheets(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const operation = (nodeConfig.operation as string) || 'read';
  const spreadsheetId = (nodeConfig.spreadsheetId as string) || '';
  const sheetName = (nodeConfig.sheetName as string) || 'Sheet1';
  const range = (input.range as string) || (nodeConfig.range as string) || 'A1:Z1000';
  const values = (input.values as any[][]) || [];

  if (!spreadsheetId) {
    return {
      success: false,
      error: {
        message: 'Spreadsheet ID is required',
        code: 'MISSING_SPREADSHEET_ID',
      },
    };
  }

  // Google Sheets API requires authentication - for now return error
  return {
    success: false,
    error: {
      message: 'Google Sheets integration requires googleapis package and OAuth2 setup. Please install: npm install googleapis',
      code: 'GOOGLE_SHEETS_NOT_AVAILABLE',
    },
  };
}

// Airtable
export async function executeAirtable(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const operation = (nodeConfig.operation as string) || 'list';
  const baseId = (nodeConfig.baseId as string) || '';
  const tableName = (nodeConfig.tableName as string) || '';
  const apiKey = (nodeConfig.apiKey as string) || process.env.AIRTABLE_API_KEY || '';
  const recordId = (nodeConfig.recordId as string) || '';
  const records = (input.records as any[]) || [];

  if (!baseId || !tableName || !apiKey) {
    return {
      success: false,
      error: {
        message: 'Base ID, Table Name, and API Key are required',
        code: 'MISSING_REQUIRED_FIELDS',
      },
    };
  }

  try {
    const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    let response: any;

    switch (operation) {
      case 'list': {
        response = await axios.get(baseUrl, { headers });
        return {
          success: true,
          output: {
            records: response.data.records || [],
            success: true,
          },
        };
      }

      case 'get': {
        if (!recordId) {
          return {
            success: false,
            error: {
              message: 'Record ID is required for get operation',
              code: 'MISSING_RECORD_ID',
            },
          };
        }
        response = await axios.get(`${baseUrl}/${recordId}`, { headers });
        return {
          success: true,
          output: {
            records: [response.data],
            success: true,
          },
        };
      }

      case 'create': {
        if (records.length === 0) {
          return {
            success: false,
            error: {
              message: 'Records are required for create operation',
              code: 'MISSING_RECORDS',
            },
          };
        }
        response = await axios.post(
          baseUrl,
          { records: records.map((r) => ({ fields: r })) },
          { headers }
        );
        return {
          success: true,
          output: {
            records: response.data.records || [],
            success: true,
          },
        };
      }

      case 'update': {
        if (!recordId || records.length === 0) {
          return {
            success: false,
            error: {
              message: 'Record ID and fields are required for update operation',
              code: 'MISSING_REQUIRED_FIELDS',
            },
          };
        }
        response = await axios.patch(
          `${baseUrl}/${recordId}`,
          { fields: records[0] },
          { headers }
        );
        return {
          success: true,
          output: {
            records: [response.data],
            success: true,
          },
        };
      }

      case 'delete': {
        if (!recordId) {
          return {
            success: false,
            error: {
              message: 'Record ID is required for delete operation',
              code: 'MISSING_RECORD_ID',
            },
          };
        }
        await axios.delete(`${baseUrl}/${recordId}`, { headers });
        return {
          success: true,
          output: {
            success: true,
          },
        };
      }

      default:
        return {
          success: false,
          error: {
            message: `Unsupported operation: ${operation}`,
            code: 'UNSUPPORTED_OPERATION',
          },
        };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.error?.message || error.message || 'Airtable operation failed',
        code: 'AIRTABLE_ERROR',
        details: error.response?.data || error,
      },
    };
  }
}

// Notion
export async function executeNotion(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const operation = (nodeConfig.operation as string) || 'read';
  const apiKey = (nodeConfig.apiKey as string) || process.env.NOTION_API_KEY || '';
  const pageId = (nodeConfig.pageId as string) || '';
  const databaseId = (nodeConfig.databaseId as string) || '';
  const content = (input.content as any) || {};

  if (!apiKey) {
    return {
      success: false,
      error: {
        message: 'Notion API key is required',
        code: 'MISSING_API_KEY',
      },
    };
  }

  // Notion API requires specific setup - for now return error
  return {
    success: false,
    error: {
      message: 'Notion integration requires @notionhq/client package. Please install: npm install @notionhq/client',
      code: 'NOTION_NOT_AVAILABLE',
    },
  };
}

// Zapier Webhook
export async function executeZapier(context: NodeExecutionContext): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;

  const webhookUrl = (nodeConfig.webhookUrl as string) || '';
  const method = (nodeConfig.method as string) || 'POST';
  const data = (input.data as any) || input;

  if (!webhookUrl) {
    return {
      success: false,
      error: {
        message: 'Zapier webhook URL is required',
        code: 'MISSING_WEBHOOK_URL',
      },
    };
  }

  try {
    const response = await axios({
      method: method.toLowerCase(),
      url: webhookUrl,
      data: method.toUpperCase() === 'GET' ? undefined : data,
      params: method.toUpperCase() === 'GET' ? data : undefined,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return {
      success: true,
      output: {
        response: response.data,
        success: true,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data || error.message || 'Zapier webhook trigger failed',
        code: 'ZAPIER_ERROR',
        details: error.response?.data || error,
      },
    };
  }
}

