import { db } from '../config/database';
import { webhookRegistry, workflows, workspaces, organizations } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { WorkflowDefinition } from '@sos/shared';
import { emailTriggerService } from './emailTriggerService';

/**
 * Update webhook registry when a workflow is saved
 */
export async function updateWebhookRegistry(workflowId: string, definition: WorkflowDefinition) {
  // Remove existing webhooks for this workflow
  await db.delete(webhookRegistry).where(eq(webhookRegistry.workflowId, workflowId));

  // Find all webhook trigger nodes
  const webhookNodes = definition.nodes.filter(
    (node) => (node.data?.type as string) === 'trigger.webhook'
  );

  // Register each webhook
  for (const node of webhookNodes) {
    const config = node.data?.config as any;
    const path = config?.path as string;
    const method = (config?.method as string) || 'POST';

    if (path) {
      await db.insert(webhookRegistry).values({
        workflowId,
        path: path.startsWith('/') ? path : `/${path}`,
        method: method.toUpperCase(),
        nodeId: node.id,
        active: true,
      });
    }
  }
}

/**
 * Get webhook URL for a workflow
 */
export async function getWebhookUrl(workflowId: string, nodeId: string): Promise<string | null> {
  const [webhook] = await db
    .select()
    .from(webhookRegistry)
    .where(and(eq(webhookRegistry.workflowId, workflowId), eq(webhookRegistry.nodeId, nodeId)))
    .limit(1);

  if (!webhook) return null;

  const baseUrl = process.env.API_URL || process.env.WEBHOOK_BASE_URL || 'http://localhost:4000';
  return `${baseUrl}/webhooks${webhook.path}`;
}

/**
 * Update email trigger registry when a workflow is saved
 */
export async function updateEmailTriggerRegistry(
  workflowId: string,
  definition: WorkflowDefinition,
  userId: string,
  organizationId?: string
) {
  // Get workflow to find organization
  const [workflow] = await db
    .select({
      workspaceId: workflows.workspaceId,
    })
    .from(workflows)
    .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
    .where(eq(workflows.id, workflowId))
    .limit(1);

  if (!workflow) return;

  // Get organization ID if not provided
  let orgId = organizationId;
  if (!orgId) {
    const [workspace] = await db
      .select({ organizationId: workspaces.organizationId })
      .from(workspaces)
      .where(eq(workspaces.id, workflow.workspaceId))
      .limit(1);
    orgId = workspace?.organizationId || undefined;
  }

  // Find all email trigger nodes
  const emailTriggerNodes = definition.nodes.filter(
    (node) => (node.data?.type as string)?.startsWith('trigger.email.')
  );

  // Unregister all existing email triggers for this workflow
  for (const node of definition.nodes) {
    if ((node.data?.type as string)?.startsWith('trigger.email.')) {
      await emailTriggerService.unregisterEmailTrigger(workflowId, node.id);
    }
  }

  // Register each email trigger
  for (const node of emailTriggerNodes) {
    const config = node.data?.config as any;
    const provider = (node.data?.type as string)?.replace('trigger.email.', '') as 'gmail' | 'outlook' | 'imap';
    const email = config?.email as string;
    const credentials = config?.credentials as Record<string, unknown>;

    if (email && credentials && (provider === 'gmail' || provider === 'outlook' || provider === 'imap')) {
      await emailTriggerService.registerEmailTrigger(
        workflowId,
        node.id,
        {
          provider,
          email,
          credentials,
          folder: config?.folder || 'INBOX',
          pollInterval: config?.pollInterval || 60,
          filters: config?.filters || undefined,
        },
        userId,
        orgId
      );
    }
  }
}

