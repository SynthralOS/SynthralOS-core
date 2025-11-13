import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { db } from '../config/database';
import {
  workflowExecutions,
  executionLogs,
  workflows,
  workspaces,
  organizations,
  organizationMembers,
} from '../../drizzle/schema';
import { eq, and, gte, lte, count, sql, desc, inArray, avg, sum } from 'drizzle-orm';

const router = Router();

// All routes require authentication and organization
router.use(authenticate);
router.use(setOrganization);

// Get workflow analytics
router.get('/workflows', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { workflowId, startDate, endDate } = req.query;

    // Use organizationId from middleware
    const orgIds = [req.organizationId];

    if (orgIds.length === 0) {
      return res.json({
        totalExecutions: 0,
        successRate: 0,
        averageExecutionTime: 0,
        totalErrors: 0,
        executionsByStatus: {},
        executionsOverTime: [],
      });
    }

    // Build date filter
    const dateFilter: any[] = [];
    if (startDate) {
      dateFilter.push(gte(workflowExecutions.startedAt, new Date(startDate as string)));
    }
    if (endDate) {
      dateFilter.push(lte(workflowExecutions.startedAt, new Date(endDate as string)));
    }

    // Build workflow filter
    const workflowFilter: any[] = [];
    if (workflowId) {
      workflowFilter.push(eq(workflowExecutions.workflowId, workflowId as string));
    }

    // Get total executions
    const [totalExecutionsResult] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          ...dateFilter,
          ...workflowFilter
        )
      );

    // Get successful executions
    const [successfulExecutionsResult] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          eq(workflowExecutions.status, 'completed'),
          ...dateFilter,
          ...workflowFilter
        )
      );

    // Get failed executions
    const [failedExecutionsResult] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          eq(workflowExecutions.status, 'failed'),
          ...dateFilter,
          ...workflowFilter
        )
      );

    // Get average execution time (in milliseconds)
    const [avgTimeResult] = await db
      .select({
        avgTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${workflowExecutions.finishedAt} - ${workflowExecutions.startedAt})) * 1000)`,
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          eq(workflowExecutions.status, 'completed'),
          ...dateFilter,
          ...workflowFilter
        )
      );

    // Get executions by status
    const executionsByStatus = await db
      .select({
        status: workflowExecutions.status,
        count: count(),
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          ...dateFilter,
          ...workflowFilter
        )
      )
      .groupBy(workflowExecutions.status);

    // Get executions over time (last 30 days by default)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const executionsOverTime = await db
      .select({
        date: sql<string>`DATE(${workflowExecutions.startedAt})`,
        count: count(),
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, thirtyDaysAgo),
          ...workflowFilter
        )
      )
      .groupBy(sql`DATE(${workflowExecutions.startedAt})`)
      .orderBy(sql`DATE(${workflowExecutions.startedAt})`);

    const totalExecutions = totalExecutionsResult?.count || 0;
    const successfulExecutions = successfulExecutionsResult?.count || 0;
    const failedExecutions = failedExecutionsResult?.count || 0;
    const successRate = totalExecutions > 0
      ? Math.round((successfulExecutions / totalExecutions) * 100)
      : 0;
    const averageExecutionTime = avgTimeResult?.avgTime ? Math.round(Number(avgTimeResult.avgTime)) : 0;

    const statusMap: Record<string, number> = {};
    executionsByStatus.forEach((item) => {
      statusMap[item.status] = item.count;
    });

    res.json({
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate,
      averageExecutionTime,
      totalErrors: failedExecutions,
      executionsByStatus: statusMap,
      executionsOverTime: executionsOverTime.map((item) => ({
        date: item.date,
        count: item.count,
      })),
    });
  } catch (error) {
    console.error('Error fetching workflow analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get node performance metrics
router.get('/nodes', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { startDate, endDate } = req.query;

    // Use organizationId from middleware
    const orgIds = [req.organizationId];

    if (orgIds.length === 0) {
      return res.json({
        mostUsedNodes: [],
        nodePerformance: [],
        averageNodeExecutionTime: {},
      });
    }

    // Build date filter
    const dateFilter: any[] = [];
    if (startDate) {
      dateFilter.push(gte(executionLogs.timestamp, new Date(startDate as string)));
    }
    if (endDate) {
      dateFilter.push(lte(executionLogs.timestamp, new Date(endDate as string)));
    }

    // Get most used nodes (by log count)
    const mostUsedNodes = await db
      .select({
        nodeId: executionLogs.nodeId,
        count: count(),
      })
      .from(executionLogs)
      .innerJoin(workflowExecutions, eq(executionLogs.executionId, workflowExecutions.id))
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          ...dateFilter
        )
      )
      .groupBy(executionLogs.nodeId)
      .orderBy(desc(count()))
      .limit(10);

    // Get node performance (success/error rates)
    const nodePerformance = await db
      .select({
        nodeId: executionLogs.nodeId,
        level: executionLogs.level,
        count: count(),
      })
      .from(executionLogs)
      .innerJoin(workflowExecutions, eq(executionLogs.executionId, workflowExecutions.id))
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          ...dateFilter
        )
      )
      .groupBy(executionLogs.nodeId, executionLogs.level)
      .orderBy(executionLogs.nodeId);

    // Calculate success rates per node
    const nodeStats: Record<string, { total: number; errors: number; successRate: number }> = {};
    nodePerformance.forEach((item) => {
      if (!nodeStats[item.nodeId]) {
        nodeStats[item.nodeId] = { total: 0, errors: 0, successRate: 0 };
      }
      nodeStats[item.nodeId].total += item.count;
      if (item.level === 'error') {
        nodeStats[item.nodeId].errors += item.count;
      }
    });

    Object.keys(nodeStats).forEach((nodeId) => {
      const stats = nodeStats[nodeId];
      stats.successRate = stats.total > 0
        ? Math.round(((stats.total - stats.errors) / stats.total) * 100)
        : 0;
    });

    res.json({
      mostUsedNodes: mostUsedNodes.map((item) => ({
        nodeId: item.nodeId,
        count: item.count,
      })),
      nodePerformance: Object.entries(nodeStats).map(([nodeId, stats]) => ({
        nodeId,
        ...stats,
      })),
      averageNodeExecutionTime: {}, // Would need execution time per node in logs
    });
  } catch (error) {
    console.error('Error fetching node analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get cost tracking (AI token usage)
router.get('/costs', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { startDate, endDate } = req.query;

    // Use organizationId from middleware
    const orgIds = [req.organizationId];

    if (orgIds.length === 0) {
      return res.json({
        totalTokens: 0,
        totalCost: 0,
        tokensByNode: [],
        costByNode: [],
        costOverTime: [],
      });
    }

    // Build date filter
    const dateFilter: any[] = [];
    if (startDate) {
      dateFilter.push(gte(workflowExecutions.startedAt, new Date(startDate as string)));
    }
    if (endDate) {
      dateFilter.push(lte(workflowExecutions.startedAt, new Date(endDate as string)));
    }

    // Get executions with metadata containing token usage
    const executions = await db
      .select({
        id: workflowExecutions.id,
        metadata: workflowExecutions.metadata,
        startedAt: workflowExecutions.startedAt,
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          ...dateFilter
        )
      );

    // Extract token usage from metadata
    let totalTokens = 0;
    let totalCost = 0;
    const tokensByNode: Record<string, number> = {};
    const costByNode: Record<string, number> = {};

    executions.forEach((execution) => {
      const metadata = execution.metadata as any;
      if (metadata?.tokensUsed) {
        totalTokens += metadata.tokensUsed;
      }
      if (metadata?.cost) {
        totalCost += metadata.cost;
      }
      // Extract per-node token usage from logs if available
    });

    // Get cost over time
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const costOverTime = await db
      .select({
        date: sql<string>`DATE(${workflowExecutions.startedAt})`,
        totalCost: sql<number>`SUM(CAST(${workflowExecutions.metadata}->>'cost' AS NUMERIC))`,
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, thirtyDaysAgo),
          ...dateFilter
        )
      )
      .groupBy(sql`DATE(${workflowExecutions.startedAt})`)
      .orderBy(sql`DATE(${workflowExecutions.startedAt})`);

    res.json({
      totalTokens,
      totalCost: Math.round(totalCost * 100) / 100, // Round to 2 decimal places
      tokensByNode: Object.entries(tokensByNode).map(([nodeId, tokens]) => ({
        nodeId,
        tokens,
      })),
      costByNode: Object.entries(costByNode).map(([nodeId, cost]) => ({
        nodeId,
        cost: Math.round(cost * 100) / 100,
      })),
      costOverTime: costOverTime.map((item) => ({
        date: item.date,
        cost: item.totalCost ? Math.round(Number(item.totalCost) * 100) / 100 : 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching cost analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get error analysis
router.get('/errors', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { startDate, endDate, limit = '10' } = req.query;

    // Use organizationId from middleware
    const orgIds = [req.organizationId];

    if (orgIds.length === 0) {
      return res.json({
        commonErrors: [],
        errorsByNode: [],
        errorsOverTime: [],
      });
    }

    // Build date filter
    const dateFilter: any[] = [];
    if (startDate) {
      dateFilter.push(gte(executionLogs.timestamp, new Date(startDate as string)));
    }
    if (endDate) {
      dateFilter.push(lte(executionLogs.timestamp, new Date(endDate as string)));
    }

    // Get common errors
    const commonErrors = await db
      .select({
        message: executionLogs.message,
        count: count(),
      })
      .from(executionLogs)
      .innerJoin(workflowExecutions, eq(executionLogs.executionId, workflowExecutions.id))
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          eq(executionLogs.level, 'error'),
          ...dateFilter
        )
      )
      .groupBy(executionLogs.message)
      .orderBy(desc(count()))
      .limit(parseInt(limit as string, 10));

    // Get errors by node
    const errorsByNode = await db
      .select({
        nodeId: executionLogs.nodeId,
        count: count(),
      })
      .from(executionLogs)
      .innerJoin(workflowExecutions, eq(executionLogs.executionId, workflowExecutions.id))
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          eq(executionLogs.level, 'error'),
          ...dateFilter
        )
      )
      .groupBy(executionLogs.nodeId)
      .orderBy(desc(count()))
      .limit(10);

    // Get errors over time
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const errorsOverTime = await db
      .select({
        date: sql<string>`DATE(${executionLogs.timestamp})`,
        count: count(),
      })
      .from(executionLogs)
      .innerJoin(workflowExecutions, eq(executionLogs.executionId, workflowExecutions.id))
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          eq(executionLogs.level, 'error'),
          gte(executionLogs.timestamp, thirtyDaysAgo),
          ...dateFilter
        )
      )
      .groupBy(sql`DATE(${executionLogs.timestamp})`)
      .orderBy(sql`DATE(${executionLogs.timestamp})`);

    res.json({
      commonErrors: commonErrors.map((item) => ({
        message: item.message,
        count: item.count,
      })),
      errorsByNode: errorsByNode.map((item) => ({
        nodeId: item.nodeId,
        count: item.count,
      })),
      errorsOverTime: errorsOverTime.map((item) => ({
        date: item.date,
        count: item.count,
      })),
    });
  } catch (error) {
    console.error('Error fetching error analysis:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get usage statistics
router.get('/usage', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { startDate, endDate } = req.query;

    // Use organizationId from middleware
    const orgIds = [req.organizationId];

    if (orgIds.length === 0) {
      return res.json({
        totalExecutions: 0,
        executionsByHour: [],
        peakHours: [],
        executionsByDay: [],
      });
    }

    // Build date filter
    const dateFilter: any[] = [];
    if (startDate) {
      dateFilter.push(gte(workflowExecutions.startedAt, new Date(startDate as string)));
    }
    if (endDate) {
      dateFilter.push(lte(workflowExecutions.startedAt, new Date(endDate as string)));
    }

    // Get executions by hour of day
    const executionsByHour = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${workflowExecutions.startedAt})`,
        count: count(),
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          ...dateFilter
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${workflowExecutions.startedAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${workflowExecutions.startedAt})`);

    // Get executions by day of week
    const executionsByDay = await db
      .select({
        day: sql<number>`EXTRACT(DOW FROM ${workflowExecutions.startedAt})`,
        count: count(),
      })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          ...dateFilter
        )
      )
      .groupBy(sql`EXTRACT(DOW FROM ${workflowExecutions.startedAt})`)
      .orderBy(sql`EXTRACT(DOW FROM ${workflowExecutions.startedAt})`);

    // Get total executions
    const [totalExecutionsResult] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          ...dateFilter
        )
      );

    // Find peak hours (top 3)
    const peakHours = executionsByHour
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((item) => ({
        hour: item.hour,
        count: item.count,
      }));

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    res.json({
      totalExecutions: totalExecutionsResult?.count || 0,
      executionsByHour: executionsByHour.map((item) => ({
        hour: item.hour,
        count: item.count,
      })),
      peakHours,
      executionsByDay: executionsByDay.map((item) => ({
        day: dayNames[item.day] || `Day ${item.day}`,
        count: item.count,
      })),
    });
  } catch (error) {
    console.error('Error fetching usage statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

