/**
 * Asana Connector Executor
 * 
 * Executes Asana connector actions using the Asana REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface AsanaCredentials {
  access_token: string;
}

/**
 * Create Asana API client
 */
function createAsanaClient(credentials: AsanaCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://app.asana.com/api/1.0',
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a task in Asana
 */
export async function executeAsanaCreateTask(
  workspace: string,
  name: string,
  notes?: string,
  credentials: AsanaCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createAsanaClient(credentials);
    
    const taskData: Record<string, unknown> = {
      workspace,
      name,
    };
    
    if (notes) {
      taskData.notes = notes;
    }

    const response = await client.post('/tasks', { data: taskData });

    return {
      success: true,
      output: {
        id: response.data.data.gid,
        name: response.data.data.name,
        permalink_url: response.data.data.permalink_url,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.errors?.[0]?.message || error.message || 'Asana task creation failed',
        code: 'ASANA_CREATE_TASK_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get tasks from an Asana project
 */
export async function executeAsanaGetTasks(
  projectId: string,
  limit?: number,
  credentials: AsanaCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createAsanaClient(credentials);
    
    const params: Record<string, unknown> = {
      project: projectId,
    };
    
    if (limit) {
      params.limit = limit;
    }

    const response = await client.get('/tasks', { params });

    return {
      success: true,
      output: {
        tasks: response.data.data || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.errors?.[0]?.message || error.message || 'Asana get tasks failed',
        code: 'ASANA_GET_TASKS_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Asana connector action
 */
export async function executeAsana(
  actionId: string,
  input: Record<string, unknown>,
  credentials: AsanaCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_task':
      const workspace = input.workspace as string;
      const name = input.name as string;
      const notes = input.notes as string | undefined;
      
      if (!workspace || !name) {
        return {
          success: false,
          error: {
            message: 'workspace and name are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeAsanaCreateTask(workspace, name, notes, credentials);

    case 'get_tasks':
      const projectId = input.projectId as string;
      const limit = input.limit as number | undefined;
      
      if (!projectId) {
        return {
          success: false,
          error: {
            message: 'projectId is required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeAsanaGetTasks(projectId, limit, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown Asana action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

