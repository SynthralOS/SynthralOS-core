import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { auditLogMiddleware } from '../middleware/auditLog';
import { nangoService } from '../services/nangoService';
import { connectorRouter, ConnectorProvider } from '../services/connectorRouter';
import { connectorRegistry } from '../services/connectors/registry';

const router = Router();

// Apply authentication and audit logging
router.use(authenticate);
router.use(setOrganization);
router.use(auditLogMiddleware);

/**
 * Initiate OAuth flow for a provider via Nango
 * GET /api/v1/nango/oauth/:provider/authorize
 * 
 * Query params:
 * - connectionId (optional): Existing connection ID for reconnection
 */
router.get('/oauth/:provider/authorize', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { provider } = req.params;
    const { connectionId } = req.query;

    // Verify connector exists
    const connector = connectorRegistry.get(provider);
    if (!connector) {
      return res.status(404).json({ error: `Connector ${provider} not found` });
    }

    // Check if connector should use Nango
    const routingDecision = await connectorRouter.routeSimple(
      provider,
      req.user.id,
      req.organizationId
    );

    if (routingDecision.provider !== ConnectorProvider.NANGO) {
      return res.status(400).json({
        error: `Connector ${provider} should not use Nango`,
        reason: routingDecision.reason,
        suggestedProvider: routingDecision.provider,
      });
    }

    // Initiate OAuth flow
    const result = await nangoService.initiateOAuth(
      provider,
      req.user.id,
      req.organizationId,
      connectionId as string | undefined
    );

    res.json({
      authUrl: result.authUrl,
      state: result.state,
      provider,
    });
  } catch (error: any) {
    console.error(`[Nango] Error initiating OAuth for ${req.params.provider}:`, error);
    res.status(500).json({
      error: 'Failed to initiate OAuth flow',
      message: error.message || 'Unknown error',
    });
  }
});

/**
 * Handle OAuth callback from Nango
 * GET /api/v1/nango/oauth/:provider/callback
 * 
 * Query params:
 * - connectionId: The connection ID from the OAuth flow
 */
router.get('/oauth/:provider/callback', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=unauthorized`
      );
    }

    const { provider } = req.params;
    const { connectionId, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=${encodeURIComponent(oauthError as string)}`
      );
    }

    if (!connectionId) {
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=missing_connection_id`
      );
    }

    // Handle callback and store credentials
    const connection = await nangoService.handleCallback(
      provider,
      connectionId as string,
      req.user.id,
      req.organizationId
    );

    // Redirect to frontend with success
    return res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?connected=${provider}&connectionId=${connection.id}`
    );
  } catch (error: any) {
    console.error(`[Nango] Error handling callback for ${req.params.provider}:`, error);
    return res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/workflows?error=${encodeURIComponent(error.message || 'oauth_callback_failed')}`
    );
  }
});

/**
 * Refresh access token for a connection
 * POST /api/v1/nango/oauth/:provider/refresh
 * 
 * Body:
 * - connectionId: The connection ID to refresh
 */
router.post('/oauth/:provider/refresh', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { provider } = req.params;
    const { connectionId } = req.body;

    if (!connectionId) {
      return res.status(400).json({ error: 'connectionId is required' });
    }

    // Refresh token
    const credentials = await nangoService.refreshToken(provider, connectionId);

    res.json({
      success: true,
      credentials,
      provider,
      connectionId,
    });
  } catch (error: any) {
    console.error(`[Nango] Error refreshing token for ${req.params.provider}:`, error);
    res.status(500).json({
      error: 'Failed to refresh token',
      message: error.message || 'Unknown error',
    });
  }
});

/**
 * Get all connections for the authenticated user
 * GET /api/v1/nango/connections
 * 
 * Query params:
 * - provider (optional): Filter by provider
 */
router.get('/connections', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { provider } = req.query;

    // Get all connections
    let connections = await nangoService.getConnections(req.user.id, req.organizationId);

    // Filter by provider if specified
    if (provider) {
      connections = connections.filter((conn) => conn.provider === provider);
    }

    res.json({
      connections: connections.map((conn) => ({
        id: conn.id,
        provider: conn.provider,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
        // Don't expose full credentials, just indicate if they exist
        hasCredentials: !!conn.credentials.access_token,
      })),
    });
  } catch (error: any) {
    console.error('[Nango] Error getting connections:', error);
    res.status(500).json({
      error: 'Failed to get connections',
      message: error.message || 'Unknown error',
    });
  }
});

/**
 * Get a specific connection
 * GET /api/v1/nango/connections/:connectionId
 */
router.get('/connections/:connectionId', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { connectionId } = req.params;

    // Get all connections and find the one matching the ID
    const connections = await nangoService.getConnections(req.user.id, req.organizationId);
    const connection = connections.find((conn) => conn.id === connectionId);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({
      id: connection.id,
      provider: connection.provider,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
      // Don't expose full credentials
      hasCredentials: !!connection.credentials.access_token,
    });
  } catch (error: any) {
    console.error('[Nango] Error getting connection:', error);
    res.status(500).json({
      error: 'Failed to get connection',
      message: error.message || 'Unknown error',
    });
  }
});

/**
 * Delete a connection
 * DELETE /api/v1/nango/connections/:connectionId
 */
router.delete('/connections/:connectionId', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { connectionId } = req.params;
    const { provider } = req.query;

    if (!provider) {
      return res.status(400).json({ error: 'provider query parameter is required' });
    }

    // Delete connection
    await nangoService.deleteConnection(provider as string, connectionId, req.user.id);

    res.json({
      success: true,
      message: 'Connection deleted successfully',
    });
  } catch (error: any) {
    console.error('[Nango] Error deleting connection:', error);
    res.status(500).json({
      error: 'Failed to delete connection',
      message: error.message || 'Unknown error',
    });
  }
});

export default router;

