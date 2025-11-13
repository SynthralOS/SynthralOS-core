import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { auditLogMiddleware } from '../middleware/auditLog';
import { observabilityService } from '../services/observabilityService';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(setOrganization);
router.use(auditLogMiddleware);

/**
 * Get system metrics
 * GET /api/v1/observability/metrics?range=24h
 */
router.get('/metrics', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { range = '24h', workspaceId } = req.query;

    // Get metrics from observability service (database-backed)
    const metrics = await observabilityService.getSystemMetrics(
      range as string,
      req.user?.id,
      (workspaceId as string) || undefined
    );
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching observability metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get error logs
 * GET /api/v1/observability/errors?range=24h
 */
router.get('/errors', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { range = '24h', workspaceId } = req.query;

    // Get error logs from observability service (database-backed)
    const errorLogs = await observabilityService.getErrorLogs(
      range as string,
      req.user?.id,
      (workspaceId as string) || undefined
    );
    res.json(errorLogs);
  } catch (error) {
    console.error('Error fetching error logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

