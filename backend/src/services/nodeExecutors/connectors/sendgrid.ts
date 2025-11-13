/**
 * SendGrid Connector Executor
 * 
 * Executes SendGrid connector actions using the SendGrid REST API
 */

import axios, { AxiosInstance } from 'axios';
import { NodeExecutionResult } from '@sos/shared';

interface SendGridCredentials {
  api_key: string;
}

/**
 * Create SendGrid API client
 */
function createSendGridClient(credentials: SendGridCredentials): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.sendgrid.com/v3',
    headers: {
      'Authorization': `Bearer ${credentials.api_key}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Send email via SendGrid
 */
export async function executeSendGridSendEmail(
  to: string,
  from: string,
  subject: string,
  text?: string,
  html?: string,
  cc?: string[],
  bcc?: string[],
  credentials: SendGridCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createSendGridClient(credentials);
    
    const personalizations = [{
      to: [{ email: to }],
      ...(cc && cc.length > 0 && { cc: cc.map(email => ({ email })) }),
      ...(bcc && bcc.length > 0 && { bcc: bcc.map(email => ({ email })) }),
    }];

    const emailData: Record<string, unknown> = {
      personalizations,
      from: { email: from },
      subject,
    };

    const content: Array<{ type: string; value: string }> = [];
    if (text) content.push({ type: 'text/plain', value: text });
    if (html) content.push({ type: 'text/html', value: html });
    
    if (content.length === 0) {
      return {
        success: false,
        error: {
          message: 'Either text or html content is required',
          code: 'MISSING_CONTENT',
        },
      };
    }

    emailData.content = content;

    const response = await client.post('/mail/send', emailData);

    return {
      success: true,
      output: {
        messageId: response.headers['x-message-id'] || 'sent',
        statusCode: response.status,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.errors?.[0]?.message || error.message || 'SendGrid email send failed',
        code: 'SENDGRID_EMAIL_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Send template email via SendGrid
 */
export async function executeSendGridSendTemplateEmail(
  to: string,
  from: string,
  templateId: string,
  dynamicTemplateData?: Record<string, unknown>,
  credentials: SendGridCredentials
): Promise<NodeExecutionResult> {
  try {
    const client = createSendGridClient(credentials);
    
    const personalizations = [{
      to: [{ email: to }],
      ...(dynamicTemplateData && { dynamic_template_data: dynamicTemplateData }),
    }];

    const emailData = {
      personalizations,
      from: { email: from },
      template_id: templateId,
    };

    const response = await client.post('/mail/send', emailData);

    return {
      success: true,
      output: {
        messageId: response.headers['x-message-id'] || 'sent',
        statusCode: response.status,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.errors?.[0]?.message || error.message || 'SendGrid template email send failed',
        code: 'SENDGRID_TEMPLATE_EMAIL_ERROR',
        details: error.response?.data,
      },
    };
  }
}

/**
 * Execute SendGrid connector action
 */
export async function executeSendGrid(
  actionId: string,
  input: Record<string, unknown>,
  credentials: SendGridCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'send_email':
      const to = input.to as string;
      const from = input.from as string;
      const subject = input.subject as string;
      
      if (!to || !from || !subject) {
        return {
          success: false,
          error: {
            message: 'to, from, and subject are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeSendGridSendEmail(
        to,
        from,
        subject,
        input.text as string | undefined,
        input.html as string | undefined,
        input.cc as string[] | undefined,
        input.bcc as string[] | undefined,
        credentials
      );

    case 'send_template_email':
      const templateTo = input.to as string;
      const templateFrom = input.from as string;
      const templateId = input.templateId as string;
      
      if (!templateTo || !templateFrom || !templateId) {
        return {
          success: false,
          error: {
            message: 'to, from, and templateId are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeSendGridSendTemplateEmail(
        templateTo,
        templateFrom,
        templateId,
        input.dynamicTemplateData as Record<string, unknown> | undefined,
        credentials
      );

    default:
      return {
        success: false,
        error: {
          message: `Unknown SendGrid action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

