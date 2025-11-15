import { db } from '../config/database';
import { codeExecLogs } from '../../drizzle/schema';
import { lt, and, eq } from 'drizzle-orm';
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Audit Log Retention Service
 * 
 * Implements 90-day audit log retention policy for code execution logs.
 * Automatically deletes logs older than the retention period.
 */

export interface RetentionConfig {
  retentionDays?: number; // Default: 90 days
  organizationId?: string; // Optional: scope to specific organization
  dryRun?: boolean; // If true, only report what would be deleted
}

export class AuditLogRetentionService {
  private defaultRetentionDays = 90;

  /**
   * Clean up audit logs older than retention period
   */
  async cleanupOldLogs(config: RetentionConfig = {}): Promise<{
    deletedCount: number;
    oldestLogDate: Date | null;
    newestLogDate: Date | null;
  }> {
    const tracer = trace.getTracer('sos-audit-log-retention');
    const span = tracer.startSpan('auditLogRetention.cleanupOldLogs', {
      attributes: {
        'retention.days': config.retentionDays || this.defaultRetentionDays,
        'retention.dry_run': config.dryRun || false,
        'retention.organization_id': config.organizationId || 'all',
      },
    });

    try {
      const retentionDays = config.retentionDays || this.defaultRetentionDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Build query filters
      const filters: any[] = [
        lt(codeExecLogs.createdAt, cutoffDate),
      ];

      if (config.organizationId) {
        filters.push(eq(codeExecLogs.organizationId, config.organizationId));
      }

      // Get oldest and newest log dates for reporting
      const allLogs = await db
        .select({
          createdAt: codeExecLogs.createdAt,
        })
        .from(codeExecLogs)
        .where(config.organizationId ? eq(codeExecLogs.organizationId, config.organizationId) : undefined)
        .orderBy(codeExecLogs.createdAt);

      const oldestLogDate = allLogs.length > 0 ? allLogs[0].createdAt : null;
      const newestLogDate = allLogs.length > 0 ? allLogs[allLogs.length - 1].createdAt : null;

      // Count logs that would be deleted
      const logsToDelete = await db
        .select({ id: codeExecLogs.id })
        .from(codeExecLogs)
        .where(and(...filters));

      const deletedCount = logsToDelete.length;

      if (config.dryRun) {
        span.setAttributes({
          'retention.logs_to_delete': deletedCount,
          'retention.cutoff_date': cutoffDate.toISOString(),
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return {
          deletedCount,
          oldestLogDate,
          newestLogDate,
        };
      }

      // Delete old logs
      if (deletedCount > 0) {
        await db
          .delete(codeExecLogs)
          .where(and(...filters));
      }

      span.setAttributes({
        'retention.logs_deleted': deletedCount,
        'retention.cutoff_date': cutoffDate.toISOString(),
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return {
        deletedCount,
        oldestLogDate,
        newestLogDate,
      };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();
      throw error;
    }
  }

  /**
   * Get retention statistics
   */
  async getRetentionStats(organizationId?: string): Promise<{
    totalLogs: number;
    logsOlderThan90Days: number;
    oldestLogDate: Date | null;
    newestLogDate: Date | null;
    estimatedStorageMB: number;
  }> {
    const tracer = trace.getTracer('sos-audit-log-retention');
    const span = tracer.startSpan('auditLogRetention.getRetentionStats');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.defaultRetentionDays);

      const filters: any[] = [];
      if (organizationId) {
        filters.push(eq(codeExecLogs.organizationId, organizationId));
      }

      // Get all logs
      const allLogs = await db
        .select({
          createdAt: codeExecLogs.createdAt,
          durationMs: codeExecLogs.durationMs,
          memoryMb: codeExecLogs.memoryMb,
        })
        .from(codeExecLogs)
        .where(organizationId ? and(...filters) : undefined);

      const totalLogs = allLogs.length;
      const logsOlderThan90Days = allLogs.filter(
        log => log.createdAt < cutoffDate
      ).length;

      const oldestLogDate = allLogs.length > 0
        ? allLogs.reduce((oldest, log) => 
            log.createdAt < oldest ? log.createdAt : oldest, 
            allLogs[0].createdAt
          )
        : null;

      const newestLogDate = allLogs.length > 0
        ? allLogs.reduce((newest, log) => 
            log.createdAt > newest ? log.createdAt : newest, 
            allLogs[0].createdAt
          )
        : null;

      // Estimate storage (rough calculation: ~500 bytes per log entry)
      const estimatedStorageMB = (totalLogs * 500) / (1024 * 1024);

      span.setAttributes({
        'retention.total_logs': totalLogs,
        'retention.logs_older_than_90_days': logsOlderThan90Days,
        'retention.estimated_storage_mb': estimatedStorageMB,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      return {
        totalLogs,
        logsOlderThan90Days,
        oldestLogDate,
        newestLogDate,
        estimatedStorageMB,
      };
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();
      throw error;
    }
  }
}

export const auditLogRetentionService = new AuditLogRetentionService();

