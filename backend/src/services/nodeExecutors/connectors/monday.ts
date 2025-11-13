/**
 * Monday.com Connector Executor
 * 
 * Executes Monday.com connector actions using the Monday.com REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface MondayCredentials {
  api_key: string;
}

/**
 * Create Monday.com API client
 */
function createMondayClient(credentials: MondayCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.monday.com/v2',
    headers: {
      'Authorization': credentials.api_key,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an item in Monday.com
 */
export async function executeMondayCreateItem(
  boardId: string,
  itemName: string,
  columnValues?: Record<string, unknown>,
  groupId?: string,
  credentials: MondayCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createMondayClient(credentials);
    
    const mutation = `
      mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON, $groupId: String) {
        create_item (board_id: $boardId, item_name: $itemName, column_values: $columnValues, group_id: $groupId) {
          id
          name
        }
      }
    `;

    const variables: Record<string, unknown> = {
      boardId,
      itemName,
    };
    
    if (columnValues) variables.columnValues = JSON.stringify(columnValues);
    if (groupId) variables.groupId = groupId;

    const response = await client.post('', {
      query: mutation,
      variables,
    });

    if (response.data.errors) {
      return {
        success: false,
        error: {
          message: response.data.errors[0]?.message || 'Monday.com create item failed',
          code: 'MONDAY_CREATE_ITEM_ERROR',
          details: response.data.errors,
        },
      };
    }

    return {
      success: true,
      output: {
        item: response.data.data?.create_item,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.errors?.[0]?.message || error.message || 'Monday.com create item failed',
        code: 'MONDAY_CREATE_ITEM_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get items from Monday.com
 */
export async function executeMondayGetItems(
  boardId: string,
  limit?: number,
  page?: number,
  credentials: MondayCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createMondayClient(credentials);
    
    const query = `
      query ($boardId: [ID!], $limit: Int, $page: Int) {
        boards (ids: $boardId) {
          items_page (limit: $limit, page: $page) {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;

    const variables: Record<string, unknown> = {
      boardId: [boardId],
    };
    
    if (limit) variables.limit = limit;
    if (page) variables.page = page;

    const response = await client.post('', {
      query,
      variables,
    });

    if (response.data.errors) {
      return {
        success: false,
        error: {
          message: response.data.errors[0]?.message || 'Monday.com get items failed',
          code: 'MONDAY_GET_ITEMS_ERROR',
          details: response.data.errors,
        },
      };
    }

    return {
      success: true,
      output: {
        items: response.data.data?.boards?.[0]?.items_page?.items || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.errors?.[0]?.message || error.message || 'Monday.com get items failed',
        code: 'MONDAY_GET_ITEMS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Monday.com connector action
 */
export async function executeMonday(
  actionId: string,
  input: Record<string, unknown>,
  credentials: MondayCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_item':
      const boardId = input.boardId as string;
      const itemName = input.itemName as string;
      
      if (!boardId || !itemName) {
        return {
          success: false,
          error: {
            message: 'boardId and itemName are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeMondayCreateItem(
        boardId,
        itemName,
        input.columnValues as Record<string, unknown> | undefined,
        input.groupId as string | undefined,
        credentials
      );

    case 'get_items':
      const getBoardId = input.boardId as string;
      if (!getBoardId) {
        return {
          success: false,
          error: {
            message: 'boardId is required',
            code: 'MISSING_BOARD_ID',
          },
        };
      }
      return executeMondayGetItems(
        getBoardId,
        input.limit as number | undefined,
        input.page as number | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown Monday.com action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

