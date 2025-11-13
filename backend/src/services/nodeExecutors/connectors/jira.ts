/**
 * Jira Connector Executor
 * 
 * Executes Jira connector actions using the Jira REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface JiraCredentials {
  access_token: string;
  site_url: string; // e.g., 'https://your-domain.atlassian.net'
}

/**
 * Create Jira API client
 */
function createJiraClient(credentials: JiraCredentials): AxiosInstance {
  return axios.create({
    baseURL: `${credentials.site_url}/rest/api/3`,
    headers: {
      'Authorization': `Bearer ${credentials.access_token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an issue in Jira
 */
export async function executeJiraCreateIssue(
  projectKey: string,
  summary: string,
  issueType: string,
  description?: string,
  assignee?: string,
  priority?: string,
  credentials: JiraCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createJiraClient(credentials);
    
    const issueData: Record<string, unknown> = {
      fields: {
        project: {
          key: projectKey,
        },
        summary,
        issuetype: {
          name: issueType,
        },
      },
    };

    if (description) {
      (issueData.fields as any).description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: description,
              },
            ],
          },
        ],
      };
    }

    if (assignee) {
      (issueData.fields as any).assignee = {
        accountId: assignee,
      };
    }

    if (priority) {
      (issueData.fields as any).priority = {
        name: priority,
      };
    }

    const response = await client.post('/issue', issueData);

    return {
      success: true,
      output: {
        id: response.data.id,
        key: response.data.key,
        self: response.data.self,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.errorMessages?.[0] || error.message || 'Jira create issue failed',
        code: 'JIRA_CREATE_ISSUE_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Get issues from Jira
 */
export async function executeJiraGetIssues(
  jql?: string,
  projectKey?: string,
  maxResults?: number,
  startAt?: number,
  credentials: JiraCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createJiraClient(credentials);
    
    let query = jql;
    if (!query && projectKey) {
      query = `project = ${projectKey}`;
    }
    if (!query) {
      query = 'order by created DESC';
    }

    const params: Record<string, unknown> = {
      jql: query,
    };
    
    if (maxResults) params.maxResults = maxResults;
    if (startAt) params.startAt = startAt;

    const response = await client.get('/search', { params });

    return {
      success: true,
      output: {
        issues: response.data.issues || [],
        total: response.data.total || 0,
        maxResults: response.data.maxResults || 0,
        startAt: response.data.startAt || 0,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.errorMessages?.[0] || error.message || 'Jira get issues failed',
        code: 'JIRA_GET_ISSUES_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute Jira connector action
 */
export async function executeJira(
  actionId: string,
  input: Record<string, unknown>,
  credentials: JiraCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'create_issue':
      const projectKey = input.projectKey as string;
      const summary = input.summary as string;
      const issueType = input.issueType as string || 'Task';
      
      if (!projectKey || !summary) {
        return {
          success: false,
          error: {
            message: 'projectKey and summary are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeJiraCreateIssue(
        projectKey,
        summary,
        issueType,
        input.description as string | undefined,
        input.assignee as string | undefined,
        input.priority as string | undefined,
        credentials
      );

    case 'get_issues':
      return executeJiraGetIssues(
        input.jql as string | undefined,
        input.projectKey as string | undefined,
        input.maxResults as number | undefined,
        input.startAt as number | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown Jira action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

