import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { codeAgentRegistry, CreateCodeAgentInput, UpdateCodeAgentInput } from '../services/codeAgentRegistry';
import { auditLogMiddleware } from '../middleware/auditLog';
import { setOrganization } from '../middleware/organization';

const router = Router();

// Apply audit logging to all routes
router.use(auditLogMiddleware);

// Create code agent
router.post('/', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const input: CreateCodeAgentInput = {
      name: req.body.name,
      description: req.body.description,
      language: req.body.language,
      code: req.body.code,
      inputSchema: req.body.inputSchema,
      outputSchema: req.body.outputSchema,
      runtime: req.body.runtime || 'vm2',
      packages: req.body.packages || [],
      environment: req.body.environment || {},
      organizationId: req.organizationId,
      workspaceId: req.workspaceId,
      userId: req.user.id,
      isPublic: req.body.isPublic || false,
      metadata: req.body.metadata || {},
    };

    const agent = await codeAgentRegistry.createAgent(input);
    res.status(201).json(agent);
  } catch (error: any) {
    console.error('Error creating code agent:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// List code agents
router.get('/', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const filters: any = {
      organizationId: req.organizationId,
      workspaceId: req.workspaceId,
    };

    // Optional filters
    if (req.query.language) {
      filters.language = req.query.language as string;
    }
    if (req.query.isPublic !== undefined) {
      filters.isPublic = req.query.isPublic === 'true';
    }
    if (req.query.deprecated !== undefined) {
      filters.deprecated = req.query.deprecated === 'true';
    }

    const agents = await codeAgentRegistry.listAgents(filters);
    res.json(agents);
  } catch (error: any) {
    console.error('Error listing code agents:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get code agent by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const version = req.query.version as string | undefined;
    const agent = await codeAgentRegistry.getAgent(req.params.id, version);

    if (!agent) {
      res.status(404).json({ error: 'Code agent not found' });
      return;
    }

    res.json(agent);
  } catch (error: any) {
    console.error('Error getting code agent:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update code agent (creates new version)
router.put('/:id', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const input: UpdateCodeAgentInput = {
      name: req.body.name,
      description: req.body.description,
      code: req.body.code,
      inputSchema: req.body.inputSchema,
      outputSchema: req.body.outputSchema,
      runtime: req.body.runtime,
      packages: req.body.packages,
      environment: req.body.environment,
      changelog: req.body.changelog,
      deprecated: req.body.deprecated,
      metadata: req.body.metadata,
    };

    const agent = await codeAgentRegistry.updateAgent(req.params.id, input);
    res.json(agent);
  } catch (error: any) {
    console.error('Error updating code agent:', error);
    if (error.message === 'Agent not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
});

// Delete code agent
router.delete('/:id', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await codeAgentRegistry.deleteAgent(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting code agent:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get agent versions
router.get('/:id/versions', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const versions = await codeAgentRegistry.getVersions(req.params.id);
    res.json(versions);
  } catch (error: any) {
    console.error('Error getting agent versions:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Export agent as LangChain tool
router.post('/:id/export-tool', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const version = req.query.version as string | undefined;
    const toolManifest = await codeAgentRegistry.exportAsTool(req.params.id, version);
    res.json(toolManifest);
  } catch (error: any) {
    console.error('Error exporting tool:', error);
    if (error.message === 'Agent not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
});

// Register agent as LangChain tool
router.post('/:id/register-tool', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const version = req.query.version as string | undefined;
    await codeAgentRegistry.registerAsTool(req.params.id, version);
    res.json({ message: 'Agent registered as tool successfully' });
  } catch (error: any) {
    console.error('Error registering tool:', error);
    if (error.message === 'Agent not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
});

// Execute code agent
router.post('/:id/execute', authenticate, setOrganization, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const version = req.query.version as string | undefined;
    const agent = await codeAgentRegistry.getAgent(req.params.id, version);

    if (!agent) {
      res.status(404).json({ error: 'Code agent not found' });
      return;
    }

    const input = req.body.input || {};

    // Execute agent code
    // This would call the code execution service
    // For now, return placeholder
    res.json({
      success: true,
      output: {
        message: `Code agent ${agent.name} executed`,
        agentId: agent.id,
        version: agent.version,
      },
    });
  } catch (error: any) {
    console.error('Error executing code agent:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get public registry (public code agents)
router.get('/registry/public', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const agents = await codeAgentRegistry.listAgents({
      isPublic: true,
      deprecated: false,
    });

    res.json(agents);
  } catch (error: any) {
    console.error('Error getting public registry:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;

