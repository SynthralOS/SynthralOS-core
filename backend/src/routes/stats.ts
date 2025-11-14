import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { db } from '../config/database';
import { workflowExecutions, workflows, workspaces, organizations, organizationMembers, scraperEvents } from '../../drizzle/schema';
import { eq, and, gte, lte, count, inArray, sql, desc } from 'drizzle-orm';
import { cacheMiddleware } from '../middleware/cache';
import { cacheService } from '../services/cacheService';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';

const router = Router();

// Get dashboard statistics (cached for 30 seconds)
router.get('/', authenticate, cacheMiddleware({ ttl: 30, prefix: 'stats' }), async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's organization IDs
    const userOrgs = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, req.user.id));

    const orgIds = userOrgs.map((org) => org.organizationId);

    if (orgIds.length === 0) {
      return res.json({
        totalWorkflows: 0,
        executionsToday: 0,
        successRate: 0,
        activeWorkflows: 0,
        scrapingStats: {
          totalScrapes: 0,
          scrapesToday: 0,
          successRate: 0,
          avgLatency: 0,
        },
      });
    }

    // Get total workflows
    const [workflowsCount] = await db
      .select({ count: count() })
      .from(workflows)
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(inArray(organizations.id, orgIds));

    // Get active workflows
    const [activeWorkflowsCount] = await db
      .select({ count: count() })
      .from(workflows)
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          eq(workflows.active, true)
        )
      );

    // Get executions today (last 24 hours)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [executionsTodayCount] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, today)
        )
      );

    // Get success rate (completed executions in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalExecutions] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, sevenDaysAgo)
        )
      );

    const [successfulExecutions] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, sevenDaysAgo),
          eq(workflowExecutions.status, 'completed')
        )
      );

    const totalExecutionsCount = totalExecutions?.count || 0;
    const successfulExecutionsCount = successfulExecutions?.count || 0;
    const successRate = totalExecutionsCount > 0 
      ? Math.round((successfulExecutionsCount / totalExecutionsCount) * 100)
      : 0;

    // Get scraping statistics
    const [totalScrapes] = await db
      .select({ count: count() })
      .from(scraperEvents)
      .where(inArray(scraperEvents.organizationId, orgIds));

    const [scrapesToday] = await db
      .select({ count: count() })
      .from(scraperEvents)
      .where(
        and(
          inArray(scraperEvents.organizationId, orgIds),
          gte(scraperEvents.createdAt, today)
        )
      );

    const [successfulScrapes] = await db
      .select({ count: count() })
      .from(scraperEvents)
      .where(
        and(
          inArray(scraperEvents.organizationId, orgIds),
          eq(scraperEvents.success, true)
        )
      );

    const scrapingSuccessRate = totalScrapes.count > 0
      ? Math.round((successfulScrapes.count / totalScrapes.count) * 100)
      : 0;

    const [avgLatencyResult] = await db
      .select({ avg: sql<number>`AVG(${scraperEvents.latencyMs})` })
      .from(scraperEvents)
      .where(inArray(scraperEvents.organizationId, orgIds));

    const avgLatency = avgLatencyResult?.avg ? Math.round(Number(avgLatencyResult.avg)) : 0;

    res.json({
      totalWorkflows: workflowsCount?.count || 0,
      activeWorkflows: activeWorkflowsCount?.count || 0,
      executionsToday: executionsTodayCount?.count || 0,
      successRate,
      scrapingStats: {
        totalScrapes: totalScrapes.count,
        scrapesToday: scrapesToday.count,
        successRate: scrapingSuccessRate,
        avgLatency,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trend data (for dashboard metrics)
router.get('/trends', authenticate, cacheMiddleware({ ttl: 60, prefix: 'stats-trends' }), async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's organization IDs
    const userOrgs = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, req.user.id));

    const orgIds = userOrgs.map((org) => org.organizationId);

    if (orgIds.length === 0) {
      return res.json({
        totalWorkflows: { value: 0, direction: 'neutral' },
        executionsToday: { value: 0, direction: 'neutral' },
        successRate: { value: 0, direction: 'neutral' },
      });
    }

    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const sixtyDaysAgo = subDays(now, 60);

    // Calculate workflow trends (last 30 days vs previous 30 days)
    const [recentWorkflows] = await db
      .select({ count: count() })
      .from(workflows)
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflows.createdAt, thirtyDaysAgo)
        )
      );

    const [previousWorkflows] = await db
      .select({ count: count() })
      .from(workflows)
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflows.createdAt, sixtyDaysAgo),
          lte(workflows.createdAt, thirtyDaysAgo)
        )
      );

    const workflowTrend = previousWorkflows?.count > 0
      ? ((recentWorkflows?.count || 0) - (previousWorkflows?.count || 0)) / previousWorkflows.count * 100
      : 0;

    // Calculate execution trends (today vs yesterday)
    const todayStart = startOfDay(now);
    const yesterdayStart = startOfDay(subDays(now, 1));
    const yesterdayEnd = endOfDay(subDays(now, 1));

    const [todayExecutions] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, todayStart)
        )
      );

    const [yesterdayExecutions] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, yesterdayStart),
          lte(workflowExecutions.startedAt, yesterdayEnd)
        )
      );

    const executionTrend = yesterdayExecutions?.count > 0
      ? ((todayExecutions?.count || 0) - (yesterdayExecutions?.count || 0)) / yesterdayExecutions.count * 100
      : 0;

    // Calculate success rate trends (last 7 days vs previous 7 days)
    const sevenDaysAgo = subDays(now, 7);
    const fourteenDaysAgo = subDays(now, 14);

    const [recentTotal] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, sevenDaysAgo)
        )
      );

    const [recentSuccess] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, sevenDaysAgo),
          eq(workflowExecutions.status, 'completed')
        )
      );

    const [previousTotal] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, fourteenDaysAgo),
          lte(workflowExecutions.startedAt, sevenDaysAgo)
        )
      );

    const [previousSuccess] = await db
      .select({ count: count() })
      .from(workflowExecutions)
      .innerJoin(workflows, eq(workflowExecutions.workflowId, workflows.id))
      .innerJoin(workspaces, eq(workflows.workspaceId, workspaces.id))
      .innerJoin(organizations, eq(workspaces.organizationId, organizations.id))
      .where(
        and(
          inArray(organizations.id, orgIds),
          gte(workflowExecutions.startedAt, fourteenDaysAgo),
          lte(workflowExecutions.startedAt, sevenDaysAgo),
          eq(workflowExecutions.status, 'completed')
        )
      );

    const recentSuccessRate = recentTotal?.count > 0
      ? (recentSuccess?.count || 0) / recentTotal.count * 100
      : 0;

    const previousSuccessRate = previousTotal?.count > 0
      ? (previousSuccess?.count || 0) / previousTotal.count * 100
      : 0;

    const successRateTrend = previousSuccessRate > 0
      ? recentSuccessRate - previousSuccessRate
      : 0;

    res.json({
      totalWorkflows: {
        value: Math.abs(workflowTrend),
        direction: workflowTrend > 0 ? 'up' : workflowTrend < 0 ? 'down' : 'neutral',
      },
      executionsToday: {
        value: Math.abs(executionTrend),
        direction: executionTrend > 0 ? 'up' : executionTrend < 0 ? 'down' : 'neutral',
      },
      successRate: {
        value: Math.abs(successRateTrend),
        direction: successRateTrend > 0 ? 'up' : successRateTrend < 0 ? 'down' : 'neutral',
      },
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get execution chart data (last 7 days)
router.get('/chart', authenticate, cacheMiddleware({ ttl: 60, prefix: 'stats-chart' }), async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's organization IDs
    const userOrgs = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, req.user.id));

    const orgIds = userOrgs.map((org) => org.organizationId);

    if (orgIds.length === 0) {
      return res.json([]);
    }

    const sevenDaysAgo = subDays(new Date(), 7);

    // Get executions grouped by day for last 7 days
    const executionsByDay = await db
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
          gte(workflowExecutions.startedAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`DATE(${workflowExecutions.startedAt})`)
      .orderBy(sql`DATE(${workflowExecutions.startedAt})`);

    // Create a map of dates to counts
    const dateMap = new Map<string, number>();
    executionsByDay.forEach((item) => {
      dateMap.set(item.date, item.count);
    });

    // Generate data for last 7 days
    const chartData = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayName = dayNames[date.getDay()];
      chartData.push({
        day: dayName,
        executions: dateMap.get(dateStr) || 0,
      });
    }

    res.json(chartData);
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent scraping events
router.get('/scraping/events', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's organization IDs
    const userOrgs = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, req.user.id));

    const orgIds = userOrgs.map((org) => org.organizationId);

    if (orgIds.length === 0) {
      return res.json([]);
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const events = await db
      .select()
      .from(scraperEvents)
      .where(inArray(scraperEvents.organizationId, orgIds))
      .orderBy(desc(scraperEvents.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(events);
  } catch (error) {
    console.error('Error fetching scraping events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

