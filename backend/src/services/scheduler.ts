import cron from 'node-cron';
import { db } from '../config/database';
import { workflows, organizations } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { workflowExecutor } from './workflowExecutor';
import { observabilityService } from './observabilityService';
import { cronBackoffService } from './cronBackoffService';
import { featureFlagService } from './featureFlagService';

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

    // Run audit log retention cleanup daily at 3 AM
    cron.schedule('0 3 * * *', async () => {
      await this.cleanupAuditLogs();
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

  /**
   * Cleanup old audit logs (90-day retention)
   * Runs daily to clean up code execution logs older than 90 days
   */
  async cleanupAuditLogs() {
    try {
      console.log('[Scheduler] Starting audit log retention cleanup...');
      
      const { auditLogRetentionService } = await import('./auditLogRetentionService');
      
      // Get all organizations
      const orgs = await db.select().from(organizations);

      let totalDeleted = 0;
      for (const org of orgs) {
        try {
          const result = await auditLogRetentionService.cleanupOldLogs({
            retentionDays: 90,
            organizationId: org.id,
            dryRun: false,
          });
          totalDeleted += result.deletedCount;
          console.log(`[Scheduler] Cleaned up ${result.deletedCount} audit logs for org ${org.id}`);
        } catch (err: any) {
          console.error(`[Scheduler] Failed to cleanup audit logs for org ${org.id}:`, err);
        }
      }

      // Also cleanup logs without organization (if any)
      try {
        const result = await auditLogRetentionService.cleanupOldLogs({
          retentionDays: 90,
          dryRun: false,
        });
        totalDeleted += result.deletedCount;
        console.log(`[Scheduler] Cleaned up ${result.deletedCount} audit logs without organization`);
      } catch (err: any) {
        console.error('[Scheduler] Failed to cleanup audit logs without organization:', err);
      }

      console.log(`[Scheduler] Audit log retention cleanup completed. Total deleted: ${totalDeleted}`);
    } catch (err: any) {
      console.error('[Scheduler] Error during audit log retention cleanup:', err);
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

          // Schedule new job with backoff support
          const task = cron.schedule(
            cronExpression,
            async () => {
              const jobKey = `${workflow.id}-${node.id}`;
              
              // Check if job should execute (not in backoff period)
              const backoffCheck = await cronBackoffService.shouldExecute(jobKey);
              
              if (!backoffCheck.shouldExecute) {
                console.log(
                  `[Scheduler] Skipping scheduled workflow ${workflow.id} (${backoffCheck.reason})` +
                  (backoffCheck.nextRetryAt ? `. Next retry: ${backoffCheck.nextRetryAt.toISOString()}` : '')
                );
                return;
              }

              try {
                // Check if backoff is enabled via feature flag
                const enableBackoff = await featureFlagService.isEnabled(
                  'enable_cron_backoff',
                  undefined,
                  workflow.workspaceId
                );

                const executionResult = await workflowExecutor.executeWorkflow({
                  workflowId: workflow.id,
                  definition,
                  input: {
                    trigger: {
                      type: 'schedule',
                      timestamp: new Date().toISOString(),
                    },
                  },
                });

                // Record success if backoff is enabled
                if (enableBackoff) {
                  await cronBackoffService.recordSuccess(jobKey);
                }
              } catch (error: any) {
                console.error(`Error executing scheduled workflow ${workflow.id}:`, error);
                
                // Check if backoff is enabled
                try {
                  const enableBackoff = await featureFlagService.isEnabled(
                    'enable_cron_backoff',
                    undefined,
                    workflow.workspaceId
                  );

                  if (enableBackoff) {
                    // Record failure and calculate backoff
                    const backoffState = await cronBackoffService.recordFailure(jobKey);
                    
                    if (backoffState.disabled) {
                      console.error(
                        `[Scheduler] Scheduled workflow ${workflow.id} disabled after ${backoffState.consecutiveFailures} consecutive failures`
                      );
                    } else {
                      console.warn(
                        `[Scheduler] Scheduled workflow ${workflow.id} will retry after backoff period. ` +
                        `Next retry: ${backoffState.nextRetryAt?.toISOString()}, ` +
                        `Consecutive failures: ${backoffState.consecutiveFailures}`
                      );
                    }
                  }
                } catch (backoffError: any) {
                  console.warn(`[Scheduler] Failed to record backoff for workflow ${workflow.id}:`, backoffError);
                }
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

