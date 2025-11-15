/**
 * Trello Connector Executor
 * 
 * Executes Trello connector actions using the Trello REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface TrelloCredentials {
  access_token: string;
  api_key?: string;
}

/**
 * Create Trello API client
 */
function createTrelloClient(credentials: TrelloCredentials): AxiosInstance {
  const apiKey = credentials.api_key || process.env.TRELLO_API_KEY || '';
  const token = credentials.access_token;
  
  return axios.create({
    baseURL: 'https://api.trello.com/1',
    params: {
      key: apiKey,
      token: token,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a card on a Trello board
 */
export async function executeTrelloCreateCard(
  boardId: string,
  listId: string,
  name: string,
  desc?: string,
  credentials: TrelloCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createTrelloClient(credentials);
    
    const cardData: Record<string, unknown> = {
      idList: listId,
      name,
    };
    
    if (desc) {
      cardData.desc = desc;
    }

    const response = await client.post('/cards', cardData);

    return {
      success: true,
      output: {
        id: response.data.id,
        name: response.data.name,
        url: response.data.url,
        shortUrl: response.data.shortUrl,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data || error.message || 'Trello card creation failed',
        code: 'TRELLO_CREATE_CARD_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get cards from a Trello board
 */
export async function executeTrelloGetCards(
  boardId: string,
  listId?: string,
  credentials: TrelloCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createTrelloClient(credentials);
    
    let url = `/boards/${boardId}/cards`;
    if (listId) {
      url = `/lists/${listId}/cards`;
    }

    const response = await client.get(url);

    return {
      success: true,
      output: {
        cards: response.data || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data || error.message || 'Trello get cards failed',
        code: 'TRELLO_GET_CARDS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Trello connector action
 */
export async function executeTrello(
  actionId: string,
  input: Record<string, unknown>,
  credentials: TrelloCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_card':
      const boardId = input.boardId as string;
      const listId = input.listId as string;
      const name = input.name as string;
      const desc = input.desc as string | undefined;
      
      if (!boardId || !listId || !name) {
        return {
          success: false,
          error: {
            message: 'boardId, listId, and name are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeTrelloCreateCard(boardId, listId, name, desc, credentials);

    case 'get_cards':
      const getBoardId = input.boardId as string;
      const getListId = input.listId as string | undefined;
      
      if (!getBoardId) {
        return {
          success: false,
          error: {
            message: 'boardId is required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeTrelloGetCards(getBoardId, getListId, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Trello action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

