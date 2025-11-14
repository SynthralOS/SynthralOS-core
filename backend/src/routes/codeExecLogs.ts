import { Router } from 'express';
import { codeExecutionLogger } from '../services/codeExecutionLogger';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';

const router = Router();

/**
 * GET /api/v1/code-exec-logs/agent/:agentId
 * Get execution logs for a specific code agent
 */
router.get('/agent/:agentId', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const logs = await codeExecutionLogger.getAgentLogs(agentId, limit);

    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error: any) {
    console.error('Error fetching agent logs:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to fetch agent logs',
        code: 'FETCH_LOGS_ERROR',
      },
    });
  }
});

/**
 * GET /api/v1/code-exec-logs/workflow/:executionId
 * Get execution logs for a workflow execution
 */
router.get('/workflow/:executionId', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    const { executionId } = req.params;

    const logs = await codeExecutionLogger.getWorkflowExecutionLogs(executionId);

    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error: any) {
    console.error('Error fetching workflow execution logs:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to fetch workflow execution logs',
        code: 'FETCH_LOGS_ERROR',
      },
    });
  }
});

/**
 * GET /api/v1/code-exec-logs/agent/:agentId/stats
 * Get execution statistics for a code agent
 */
router.get('/agent/:agentId/stats', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    const { agentId } = req.params;

    const stats = await codeExecutionLogger.getAgentStats(agentId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to fetch agent stats',
        code: 'FETCH_STATS_ERROR',
      },
    });
  }
});

export default router;

