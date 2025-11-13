import { NodeExecutionContext, NodeExecutionResult } from '@sos/shared';
import axios from 'axios';

/**
 * Send email via Resend (or other providers in the future)
 */
export async function executeEmail(
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const { input, config } = context;
  const nodeConfig = config as any;
  const provider = nodeConfig.provider || 'resend';

  // Extract email parameters from config or input
  const to = nodeConfig.to || input?.to;
  const from = nodeConfig.from || input?.from || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const subject = nodeConfig.subject || input?.subject;
  const html = nodeConfig.html || input?.html || nodeConfig.body || input?.body;
  const text = nodeConfig.text || input?.text;
  const cc = nodeConfig.cc || input?.cc;
  const bcc = nodeConfig.bcc || input?.bcc;
  const replyTo = nodeConfig.replyTo || input?.replyTo;
  const attachments = nodeConfig.attachments || input?.attachments;

  // Validate required fields
  if (!to) {
    return {
      success: false,
      error: {
        message: 'Email "to" field is required',
        code: 'MISSING_TO',
      },
    };
  }

  if (!subject) {
    return {
      success: false,
      error: {
        message: 'Email "subject" field is required',
        code: 'MISSING_SUBJECT',
      },
    };
  }

  if (!html && !text) {
    return {
      success: false,
      error: {
        message: 'Email "html" or "text" field is required',
        code: 'MISSING_BODY',
      },
    };
  }

  // Route to appropriate provider
  if (provider === 'resend') {
    return await sendViaResend({ to, from, subject, html, text, cc, bcc, replyTo, attachments });
  } else if (provider === 'smtp') {
    return {
      success: false,
      error: {
        message: 'SMTP provider not yet implemented. Please use Resend.',
        code: 'SMTP_NOT_IMPLEMENTED',
      },
    };
  } else if (provider === 'sendgrid') {
    return {
      success: false,
      error: {
        message: 'SendGrid provider not yet implemented. Please use Resend.',
        code: 'SENDGRID_NOT_IMPLEMENTED',
      },
    };
  } else if (provider === 'ses') {
    return {
      success: false,
      error: {
        message: 'AWS SES provider not yet implemented. Please use Resend.',
        code: 'SES_NOT_IMPLEMENTED',
      },
    };
  } else {
    return {
      success: false,
      error: {
        message: `Unknown email provider: ${provider}`,
        code: 'UNKNOWN_PROVIDER',
      },
    };
  }
}

/**
 * Send email via Resend API
 */
async function sendViaResend(params: {
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: any[];
}): Promise<NodeExecutionResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: {
        message: 'Resend API key not configured. Set RESEND_API_KEY environment variable.',
        code: 'RESEND_NOT_CONFIGURED',
      },
    };
  }

  try {
    // Prepare email payload
    const emailPayload: any = {
      from: params.from,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
    };

    if (params.html) emailPayload.html = params.html;
    if (params.text) emailPayload.text = params.text;
    if (params.cc) emailPayload.cc = Array.isArray(params.cc) ? params.cc : [params.cc];
    if (params.bcc) emailPayload.bcc = Array.isArray(params.bcc) ? params.bcc : [params.bcc];
    if (params.replyTo) emailPayload.reply_to = params.replyTo;
    if (params.attachments && Array.isArray(params.attachments)) {
      emailPayload.attachments = params.attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content, // Base64 encoded content
        path: att.path, // File path (alternative to content)
      }));
    }

    // Send email via Resend API
    const response = await axios.post(
      'https://api.resend.com/emails',
      emailPayload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      output: {
        messageId: response.data.id,
        to: emailPayload.to,
        from: emailPayload.from,
        subject: emailPayload.subject,
        success: true,
        response: response.data,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.response?.data?.message || error.message || 'Failed to send email',
        code: 'RESEND_ERROR',
        details: error.response?.data,
      },
    };
  }
}
