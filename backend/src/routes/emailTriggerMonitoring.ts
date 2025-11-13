import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { auditLogMiddleware } from '../middleware/auditLog';
import { emailTriggerMonitoring } from '../services/emailTriggerMonitoring';

const router = Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(setOrganization);
router.use(auditLogMiddleware);
// router.use(requirePermission({ resourceType: 'monitoring', action: 'read' })); // Enable when permissions are granular

/**
 * Get health summary
 * GET /api/v1/email-triggers/monitoring/health
 */
router.get('/health', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const summary = emailTriggerMonitoring.getHealthSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching health summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get metrics
 * GET /api/v1/email-triggers/monitoring/metrics
 */
router.get('/metrics', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const metrics = emailTriggerMonitoring.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all trigger health statuses
 * GET /api/v1/email-triggers/monitoring/health/all
 */
router.get('/health/all', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const health = emailTriggerMonitoring.getAllTriggerHealth();
    res.json(health);
  } catch (error) {
    console.error('Error fetching trigger health:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get health for a specific trigger
 * GET /api/v1/email-triggers/monitoring/health/:triggerId
 */
router.get('/health/:triggerId', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const health = emailTriggerMonitoring.getTriggerHealth(req.params.triggerId);
    
    if (!health) {
      res.status(404).json({ error: 'Trigger health not found' });
      return;
    }

    res.json(health);
  } catch (error) {
    console.error('Error fetching trigger health:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get alerts
 * GET /api/v1/email-triggers/monitoring/alerts
 */
router.get('/alerts', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const severity = req.query.severity as 'low' | 'medium' | 'high' | 'critical' | undefined;
    const includeResolved = req.query.includeResolved === 'true';

    const alerts = includeResolved
      ? emailTriggerMonitoring.getAllAlerts(limit)
      : emailTriggerMonitoring.getAlerts(limit, severity);

    res.json({ alerts });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Resolve an alert
 * POST /api/v1/email-triggers/monitoring/alerts/:alertId/resolve
 */
router.post('/alerts/:alertId/resolve', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    emailTriggerMonitoring.resolveAlert(req.params.alertId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

