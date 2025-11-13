import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { auditLogMiddleware } from '../middleware/auditLog';
import { performanceMonitoring } from '../services/performanceMonitoring';
import { cacheService } from '../services/cacheService';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(setOrganization);
router.use(auditLogMiddleware);

/**
 * Get all performance metrics
 * GET /api/v1/monitoring/performance
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const metrics = performanceMonitoring.getAllMetrics();
    res.json({ metrics });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get system metrics
 * GET /api/v1/monitoring/performance/system
 */
router.get('/system', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const systemMetrics = performanceMonitoring.getSystemMetrics();
    const cacheStats = cacheService.getStats();
    
    // Merge cache stats into system metrics
    systemMetrics.cache = {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      hitRate: cacheStats.hitRate,
    };

    res.json(systemMetrics);
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get endpoint-specific metrics
 * GET /api/v1/monitoring/performance/endpoint/:method/:endpoint
 */
router.get('/endpoint/:method/:endpoint(*)', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { method, endpoint } = req.params;
    const metrics = performanceMonitoring.getEndpointMetrics(method.toUpperCase(), endpoint);

    if (!metrics) {
      res.status(404).json({ error: 'Metrics not found for this endpoint' });
      return;
    }

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching endpoint metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get slowest endpoints
 * GET /api/v1/monitoring/performance/slowest?limit=10
 */
router.get('/slowest', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const slowest = performanceMonitoring.getSlowestEndpoints(limit);
    res.json({ endpoints: slowest });
  } catch (error) {
    console.error('Error fetching slowest endpoints:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get most requested endpoints
 * GET /api/v1/monitoring/performance/most-requested?limit=10
 */
router.get('/most-requested', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const mostRequested = performanceMonitoring.getMostRequestedEndpoints(limit);
    res.json({ endpoints: mostRequested });
  } catch (error) {
    console.error('Error fetching most requested endpoints:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get cache statistics
 * GET /api/v1/monitoring/performance/cache
 */
router.get('/cache', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stats = cacheService.getStats();
    const size = await cacheService.getSize();
    
    res.json({
      ...stats,
      size,
    });
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Reset performance metrics
 * POST /api/v1/monitoring/performance/reset
 */
router.post('/reset', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    performanceMonitoring.resetMetrics();
    cacheService.resetStats();
    
    res.json({ success: true, message: 'Metrics reset successfully' });
  } catch (error) {
    console.error('Error resetting metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

