import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { requirePermission } from '../middleware/permissions';
import { db } from '../config/database';
import { auditLogs, users } from '../../drizzle/schema';
import { eq, desc, and, gte, lte, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// All routes require authentication and organization
router.use(authenticate);
router.use(setOrganization);
// Require admin permission to view audit logs
router.use(requirePermission('audit_logs:read'));

// Get audit logs with filtering
router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Extract query parameters
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const action = req.query.action as string | undefined;
    const resourceType = req.query.resourceType as string | undefined;
    const resourceId = req.query.resourceId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string | undefined;

    // Build where conditions
    const conditions = [eq(auditLogs.organizationId, req.organizationId)];

    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    if (action) {
      conditions.push(like(auditLogs.action, `%${action}%`));
    }

    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }

    if (resourceId) {
      conditions.push(eq(auditLogs.resourceId, resourceId));
    }

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    // Search across action, resourceType, and resourceId
    if (search) {
      conditions.push(
        or(
          like(auditLogs.action, `%${search}%`),
          like(auditLogs.resourceType, `%${search}%`),
          like(auditLogs.resourceId || sql`''`, `%${search}%`)
        )!
      );
    }

    // Get audit logs with user information
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: users.email,
        userName: users.name,
        organizationId: auditLogs.organizationId,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const allLogs = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(and(...conditions));

    const total = allLogs.length;

    res.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get audit log by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [log] = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: users.email,
        userName: users.name,
        organizationId: auditLogs.organizationId,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(
        and(
          eq(auditLogs.id, req.params.id),
          eq(auditLogs.organizationId, req.organizationId)
        )
      )
      .limit(1);

    if (!log) {
      res.status(404).json({ error: 'Audit log not found' });
      return;
    }

    res.json(log);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export audit logs as CSV
router.get('/export/csv', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Extract query parameters (same as GET /)
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const action = req.query.action as string | undefined;
    const resourceType = req.query.resourceType as string | undefined;
    const resourceId = req.query.resourceId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10000; // Higher limit for export

    // Build where conditions (same as GET /)
    const conditions = [eq(auditLogs.organizationId, req.organizationId)];

    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    if (action) {
      conditions.push(like(auditLogs.action, `%${action}%`));
    }

    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }

    if (resourceId) {
      conditions.push(eq(auditLogs.resourceId, resourceId));
    }

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    if (search) {
      conditions.push(
        or(
          like(auditLogs.action, `%${search}%`),
          like(auditLogs.resourceType, `%${search}%`),
          like(auditLogs.resourceId || sql`''`, `%${search}%`)
        )!
      );
    }

    // Get all matching audit logs
    const logs = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        userEmail: users.email,
        userName: users.name,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    // Convert to CSV
    const headers = [
      'ID',
      'Timestamp',
      'User',
      'User Email',
      'Action',
      'Resource Type',
      'Resource ID',
      'IP Address',
      'User Agent',
      'Details',
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map((log) =>
        [
          log.id,
          log.createdAt.toISOString(),
          log.userName || '',
          log.userEmail || '',
          log.action,
          log.resourceType,
          log.resourceId || '',
          log.ipAddress || '',
          log.userAgent || '',
          JSON.stringify(log.details || {}),
        ]
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];

    const csvString = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.send(csvString);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

