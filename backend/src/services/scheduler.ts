import cron from 'node-cron';
import { db } from '../config/database';
import { workflows, organizations } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { workflowExecutor } from './workflowExecutor';
import { observabilityService } from './observabilityService';

class Scheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  async start() {
    // Load all active workflows with schedule triggers
    await this.loadScheduledWorkflows();

    // Reload schedules every minute
    setInterval(() => {
      this.loadScheduledWorkflows();
    }, 60000);

    // Run retention policy cleanup daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupRetentionPolicies();
    });
  }

  /**
   * Cleanup old events based on retention policies
   * Runs daily to clean up events older than retention period
   */
  async cleanupRetentionPolicies() {
    try {
      console.log('[Scheduler] Starting retention policy cleanup...');
      
      // Get all organizations with their plans
      const orgs = await db.select().from(organizations);

      for (const org of orgs) {
        try {
          await observabilityService.cleanupOldEventsForOrganization(org.id, org.plan);
        } catch (err: any) {
          console.error(`[Scheduler] Failed to cleanup events for org ${org.id}:`, err);
        }
      }

      console.log('[Scheduler] Retention policy cleanup completed');
    } catch (err: any) {
      console.error('[Scheduler] Error during retention policy cleanup:', err);
    }
  }

  async loadScheduledWorkflows() {
    try {
      const activeWorkflows = await db
        .select()
        .from(workflows)
        .where(eq(workflows.active, true));

      for (const workflow of activeWorkflows) {
        const definition = workflow.definition as any;
        if (!definition?.nodes) continue;

        // Find schedule trigger nodes
        const scheduleNodes = definition.nodes.filter(
          (node: any) => node.data?.type === 'trigger.schedule'
        );

        for (const node of scheduleNodes) {
          const config = node.data?.config || {};
          const cronExpression = config.cron as string;

          if (!cronExpression) continue;

          const jobKey = `${workflow.id}-${node.id}`;

          // Remove existing job if it exists
          if (this.jobs.has(jobKey)) {
            this.jobs.get(jobKey)?.stop();
            this.jobs.delete(jobKey);
          }

          // Validate cron expression
          if (!cron.validate(cronExpression)) {
            console.error(`Invalid cron expression for workflow ${workflow.id}: ${cronExpression}`);
            continue;
          }

          // Schedule new job
          const task = cron.schedule(
            cronExpression,
            async () => {
              try {
                await workflowExecutor.executeWorkflow({
                  workflowId: workflow.id,
                  definition,
                  input: {
                    trigger: {
                      type: 'schedule',
                      timestamp: new Date().toISOString(),
                    },
                  },
                });
              } catch (error) {
                console.error(`Error executing scheduled workflow ${workflow.id}:`, error);
              }
            },
            {
              scheduled: true,
              timezone: (config.timezone as string) || 'UTC',
            }
          );

          this.jobs.set(jobKey, task);
        }
      }
    } catch (error: any) {
      // Only log error if it's not a connection issue (which might be temporary)
      if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
        console.warn('Database connection issue when loading scheduled workflows. Will retry on next interval.');
      } else {
        console.error('Error loading scheduled workflows:', error);
      }
    }
  }

  stop() {
    for (const [key, job] of this.jobs) {
      job.stop();
      this.jobs.delete(key);
    }
  }
}

export const scheduler = new Scheduler();

