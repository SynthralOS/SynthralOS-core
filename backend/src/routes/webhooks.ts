import { Router } from 'express';
import { db } from '../config/database';
import { workflows, webhookRegistry } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { workflowExecutor } from '../services/workflowExecutor';

const router = Router();

// Webhook endpoint - no auth required (uses path-based auth)
router.all('/:path', async (req, res) => {
  try {
    const { path } = req.params;
    const method = req.method.toUpperCase();

    // Find webhook in registry
    const [webhookData] = await db
      .select({
        workflowId: webhookRegistry.workflowId,
        workflowDefinition: workflows.definition,
      })
      .from(webhookRegistry)
      .innerJoin(workflows, eq(webhookRegistry.workflowId, workflows.id))
      .where(
        and(
          eq(webhookRegistry.path, `/${path}`),
          eq(webhookRegistry.method, method),
          eq(webhookRegistry.active, true),
          eq(workflows.active, true)
        )
      )
      .limit(1);

    if (!webhookData) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    // Execute workflow with webhook data
    const webhookInput = {
      body: req.body,
      headers: req.headers,
      query: req.query,
      method: req.method,
      path: req.path,
    };

    await workflowExecutor.executeWorkflow({
      workflowId: webhookData.workflowId,
      definition: webhookData.workflowDefinition as any,
      input: webhookInput,
    });

    res.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;

