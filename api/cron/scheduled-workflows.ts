// Vercel Cron Job - Scheduled Workflows
// Runs every minute to check for scheduled workflows

import { db } from '../../backend/src/config/database';
import { workflows } from '../../backend/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { workflowExecutor } from '../../backend/src/services/workflowExecutor';

export default async function handler(req: any, res: any) {
  // Verify this is a cron request from Vercel
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get current time
    const now = new Date();
    const currentMinute = `${now.getHours()}:${now.getMinutes()}`;
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentDate = now.getDate();
    const currentMonth = now.getMonth() + 1;

    // Find workflows with schedule triggers that should run now
    const scheduledWorkflows = await db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.status, 'active'),
          // Add conditions for schedule matching
          // This is simplified - you'll need to parse cron expressions
        )
      );

    // Execute scheduled workflows
    for (const workflow of scheduledWorkflows) {
      try {
        // Parse schedule from workflow definition
        const schedule = (workflow.definition as any)?.triggers?.find(
          (t: any) => t.type === 'trigger.schedule'
        );

        if (schedule && shouldRunNow(schedule.cron, now)) {
          await workflowExecutor.execute(workflow.id, {}, {
            userId: workflow.createdBy || undefined,
            organizationId: workflow.organizationId || undefined,
            workspaceId: workflow.workspaceId || undefined,
          });
        }
      } catch (error: any) {
        console.error(`Error executing scheduled workflow ${workflow.id}:`, error);
      }
    }

    res.json({ 
      success: true, 
      executed: scheduledWorkflows.length,
      timestamp: now.toISOString()
    });
  } catch (error: any) {
    console.error('Error in scheduled workflows cron:', error);
    res.status(500).json({ error: error.message });
  }
}

// Helper to check if cron expression should run now
function shouldRunNow(cronExpression: string, now: Date): boolean {
  // Simplified cron parser - you may want to use a library like 'node-cron'
  // Format: "minute hour day month dayOfWeek"
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) return false;

  const [minute, hour, day, month, dayOfWeek] = parts;

  // Check if current time matches
  const matchesMinute = minute === '*' || minute === now.getMinutes().toString();
  const matchesHour = hour === '*' || hour === now.getHours().toString();
  const matchesDay = day === '*' || day === now.getDate().toString();
  const matchesMonth = month === '*' || month === (now.getMonth() + 1).toString();
  const matchesDayOfWeek = dayOfWeek === '*' || dayOfWeek === now.getDay().toString();

  return matchesMinute && matchesHour && matchesDay && matchesMonth && matchesDayOfWeek;
}

