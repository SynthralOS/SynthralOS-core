import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { auditLogRetentionService } from '../services/auditLogRetentionService';

const router = Router();

// Get retention statistics
router.get('/retention/stats', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stats = await auditLogRetentionService.getRetentionStats(req.organizationId);
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting retention stats:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Clean up old logs (dry run)
router.post('/retention/cleanup/dry-run', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const retentionDays = req.body.retentionDays || 90;
    const result = await auditLogRetentionService.cleanupOldLogs({
      retentionDays,
      organizationId: req.organizationId,
      dryRun: true,
    });

    res.json({
      ...result,
      message: `Would delete ${result.deletedCount} logs older than ${retentionDays} days`,
    });
  } catch (error: any) {
    console.error('Error running dry-run cleanup:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Clean up old logs (actual deletion)
router.post('/retention/cleanup', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only allow admins to perform actual cleanup
    // TODO: Add admin check middleware
    // if (!req.user.isAdmin) {
    //   res.status(403).json({ error: 'Forbidden: Admin access required' });
    //   return;
    // }

    const retentionDays = req.body.retentionDays || 90;
    const result = await auditLogRetentionService.cleanupOldLogs({
      retentionDays,
      organizationId: req.organizationId,
      dryRun: false,
    });

    res.json({
      ...result,
      message: `Deleted ${result.deletedCount} logs older than ${retentionDays} days`,
    });
  } catch (error: any) {
    console.error('Error cleaning up old logs:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
