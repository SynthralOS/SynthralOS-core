import { db } from '../config/database';
import { auditLogs } from '../../drizzle/schema';

export interface AuditLogData {
  userId?: string;
  organizationId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

class AuditService {
  /**
   * Log an audit event
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId: data.userId || null,
        organizationId: data.organizationId || null,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId || null,
        details: data.details || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      });
    } catch (error) {
      // Don't throw - audit logging should not break the application
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Log a workflow action
   */
  async logWorkflowAction(
    userId: string | undefined,
    organizationId: string | undefined,
    action: 'create' | 'update' | 'delete' | 'execute' | 'duplicate',
    workflowId: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `workflow.${action}`,
      resourceType: 'workflow',
      resourceId: workflowId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log a user action
   */
  async logUserAction(
    userId: string | undefined,
    organizationId: string | undefined,
    action: 'create' | 'update' | 'delete' | 'login' | 'logout',
    targetUserId?: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `user.${action}`,
      resourceType: 'user',
      resourceId: targetUserId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log an API key action
   */
  async logApiKeyAction(
    userId: string | undefined,
    organizationId: string | undefined,
    action: 'create' | 'update' | 'delete' | 'rotate',
    apiKeyId: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `api_key.${action}`,
      resourceType: 'api_key',
      resourceId: apiKeyId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log a role action
   */
  async logRoleAction(
    userId: string | undefined,
    organizationId: string | undefined,
    action: 'create' | 'update' | 'delete' | 'assign' | 'unassign',
    roleId: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `role.${action}`,
      resourceType: 'role',
      resourceId: roleId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log a team action
   */
  async logTeamAction(
    userId: string | undefined,
    organizationId: string | undefined,
    action: 'create' | 'update' | 'delete' | 'add_member' | 'remove_member',
    teamId: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `team.${action}`,
      resourceType: 'team',
      resourceId: teamId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log an alert action
   */
  async logAlertAction(
    userId: string | undefined,
    organizationId: string | undefined,
    action: 'create' | 'update' | 'delete' | 'trigger',
    alertId: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      organizationId,
      action: `alert.${action}`,
      resourceType: 'alert',
      resourceId: alertId,
      details,
      ipAddress,
      userAgent,
    });
  }
}

export const auditService = new AuditService();

