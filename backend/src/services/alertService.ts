import { db } from '../config/database';
import {
  alerts,
  alertHistory,
  workflowExecutions,
  workflows,
  organizations,
  workspaces,
  executionLogs,
} from '../../drizzle/schema';
import { eq, and, gte } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import axios from 'axios';

export interface AlertCondition {
  metric: string; // 'failure_rate', 'execution_time', 'error_count', 'usage_count'
  operator: '>' | '<' | '>=' | '<=' | '==';
  threshold: number;
  timeWindow?: number; // minutes
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook';
  config: {
    email?: string;
    slackWebhookUrl?: string;
    webhookUrl?: string;
  };
}

export interface AlertConfig {
  organizationId: string;
  workflowId?: string;
  name: string;
  description?: string;
  type: 'failure' | 'performance' | 'usage' | 'custom';
  conditions: AlertCondition[];
  notificationChannels: NotificationChannel[];
  cooldownMinutes?: number;
}

export class AlertService {
  private emailTransporter: nodemailer.Transporter | null = null;

  constructor() {
    // Initialize email transporter if SMTP is configured
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    ) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  async createAlert(config: AlertConfig): Promise<string> {
    const [alert] = await db
      .insert(alerts)
      .values({
        organizationId: config.organizationId,
        workflowId: config.workflowId,
        name: config.name,
        description: config.description,
        type: config.type,
        conditions: config.conditions as any,
        notificationChannels: config.notificationChannels as any,
        cooldownMinutes: config.cooldownMinutes || 60,
        status: 'active',
        enabled: true,
      })
      .returning();

    return alert.id;
  }

  async updateAlert(alertId: string, updates: Partial<AlertConfig>): Promise<void> {
    await db
      .update(alerts)
      .set({
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.conditions && { conditions: updates.conditions as any }),
        ...(updates.notificationChannels && {
          notificationChannels: updates.notificationChannels as any,
        }),
        ...(updates.cooldownMinutes !== undefined && { cooldownMinutes: updates.cooldownMinutes }),
        updatedAt: new Date(),
      })
      .where(eq(alerts.id, alertId));
  }

  async deleteAlert(alertId: string): Promise<void> {
    await db.delete(alerts).where(eq(alerts.id, alertId));
  }

  async getAlerts(organizationId: string, workflowId?: string) {
    const conditions: any[] = [eq(alerts.organizationId, organizationId)];
    if (workflowId) {
      conditions.push(eq(alerts.workflowId, workflowId));
    }

    return await db.select().from(alerts).where(and(...conditions));
  }

  async getAlert(alertId: string) {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
    return alert;
  }

  async toggleAlert(alertId: string, enabled: boolean): Promise<void> {
    await db
      .update(alerts)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(alerts.id, alertId));
  }

  async checkAlerts(executionId: string): Promise<void> {
    // Get execution details
    const [execution] = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, executionId))
      .limit(1);

    if (!execution) return;

    // Get workflow and organization
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, execution.workflowId))
      .limit(1);

    if (!workflow) return;

    const [workspaceData] = await db
      .select({
        organizationId: workspaces.organizationId,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workflow.workspaceId))
      .limit(1);

    if (!workspaceData) return;

    const orgId = workspaceData.organizationId;

    // Get active alerts for this organization and workflow
    const activeAlerts = await db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.organizationId, orgId),
          eq(alerts.enabled, true),
          eq(alerts.status, 'active')
        )
      );

    for (const alert of activeAlerts) {
      // Skip if workflow-specific alert doesn't match
      if (alert.workflowId && alert.workflowId !== execution.workflowId) {
        continue;
      }

      // Check cooldown
      if (alert.lastTriggeredAt) {
        const cooldownMs = (alert.cooldownMinutes || 60) * 60 * 1000;
        const timeSinceLastTrigger = Date.now() - new Date(alert.lastTriggeredAt).getTime();
        if (timeSinceLastTrigger < cooldownMs) {
          continue;
        }
      }

      // Check conditions
      const conditions = alert.conditions as AlertCondition[];
      let shouldTrigger = false;
      let triggerMessage = '';

      for (const condition of conditions) {
        const metricValue = await this.getMetricValue(
          condition.metric,
          execution,
          workflow.id,
          orgId,
          condition.timeWindow
        );

        if (this.evaluateCondition(metricValue, condition)) {
          shouldTrigger = true;
          triggerMessage = `${condition.metric} ${condition.operator} ${condition.threshold} (current: ${metricValue})`;
          break;
        }
      }

      if (shouldTrigger) {
        await this.triggerAlert(alert.id, executionId, triggerMessage, execution);
      }
    }
  }

  private async getMetricValue(
    metric: string,
    execution: any,
    workflowId: string,
    organizationId: string,
    timeWindow?: number
  ): Promise<number> {
    const windowStart = timeWindow
      ? new Date(Date.now() - timeWindow * 60 * 1000)
      : new Date(Date.now() - 60 * 60 * 1000); // Default 1 hour

    switch (metric) {
      case 'failure_rate':
        // Calculate failure rate in time window
        const allExecutions = await db
          .select({
            status: workflowExecutions.status,
          })
          .from(workflowExecutions)
          .where(
            and(
              eq(workflowExecutions.workflowId, workflowId),
              gte(workflowExecutions.startedAt, windowStart)
            )
          );

        const failedCount = allExecutions.filter((e) => e.status === 'failed').length;
        return allExecutions.length > 0 ? (failedCount / allExecutions.length) * 100 : 0;

      case 'execution_time':
        // Get execution time in milliseconds
        if (execution.finishedAt && execution.startedAt) {
          return (
            new Date(execution.finishedAt).getTime() -
            new Date(execution.startedAt).getTime()
          );
        }
        return 0;

      case 'error_count':
        // Count errors in time window
        const errorCount = await db
          .select()
          .from(executionLogs)
          .innerJoin(workflowExecutions, eq(executionLogs.executionId, workflowExecutions.id))
          .where(
            and(
              eq(workflowExecutions.workflowId, workflowId),
              eq(executionLogs.level, 'error'),
              gte(executionLogs.timestamp, windowStart)
            )
          );

        return errorCount.length;

      case 'usage_count':
        // Count executions in time window for organization
        const usageCount = await db
          .select()
          .from(workflowExecutions)
          .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
          .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
          .where(
            and(
              eq(workspaces.organizationId, organizationId),
              gte(workflowExecutions.startedAt, windowStart)
            )
          );

        return usageCount.length;

      default:
        return 0;
    }
  }

  private evaluateCondition(value: number, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return value === condition.threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(
    alertId: string,
    executionId: string,
    message: string,
    execution: any
  ): Promise<void> {
    const alert = await this.getAlert(alertId);
    if (!alert) return;

    // Record in history
    const [history] = await db
      .insert(alertHistory)
      .values({
        alertId,
        executionId,
        message,
        details: execution as any,
        notificationSent: false,
      })
      .returning();

    // Send notifications
    const channels = alert.notificationChannels as NotificationChannel[];
    const sentChannels: string[] = [];

    for (const channel of channels) {
      try {
        if (channel.type === 'email' && channel.config.email && this.emailTransporter) {
          await this.emailTransporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@sos-platform.com',
            to: channel.config.email,
            subject: `Alert: ${alert.name}`,
            html: `
              <h2>Alert Triggered: ${alert.name}</h2>
              <p><strong>Message:</strong> ${message}</p>
              <p><strong>Workflow:</strong> ${execution.workflowId}</p>
              <p><strong>Execution ID:</strong> ${executionId}</p>
              <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            `,
          });
          sentChannels.push('email');
        } else if (channel.type === 'slack' && channel.config.slackWebhookUrl) {
          await axios.post(channel.config.slackWebhookUrl, {
            text: `🚨 Alert: ${alert.name}`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Alert Triggered: ${alert.name}*\n${message}\n\n*Workflow:* ${execution.workflowId}\n*Execution ID:* ${executionId}`,
                },
              },
            ],
          });
          sentChannels.push('slack');
        } else if (channel.type === 'webhook' && channel.config.webhookUrl) {
          await axios.post(channel.config.webhookUrl, {
            alert: {
              id: alert.id,
              name: alert.name,
              type: alert.type,
            },
            execution: {
              id: executionId,
              workflowId: execution.workflowId,
              status: execution.status,
            },
            message,
            triggeredAt: new Date().toISOString(),
          });
          sentChannels.push('webhook');
        }
      } catch (error) {
        console.error(`Failed to send notification via ${channel.type}:`, error);
      }
    }

    // Update alert history
    await db
      .update(alertHistory)
      .set({
        notificationSent: true,
        notificationChannels: sentChannels as any,
      })
      .where(eq(alertHistory.id, history.id));

    // Update alert last triggered time
    await db
      .update(alerts)
      .set({
        lastTriggeredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(alerts.id, alertId));
  }

  async getAlertHistory(alertId: string, limit = 50) {
    return await db
      .select()
      .from(alertHistory)
      .where(eq(alertHistory.alertId, alertId))
      .orderBy(alertHistory.triggeredAt)
      .limit(limit);
  }
}

export const alertService = new AlertService();

