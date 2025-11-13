import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { requirePermission } from '../middleware/permissions';
import { teamService } from '../services/teamService';
import { db } from '../config/database';
import { teams, organizationMembers } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

// All routes require authentication and organization
router.use(authenticate);
router.use(setOrganization);
router.use(auditLogMiddleware);

// Get all teams for organization
router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const orgTeams = await teamService.getTeams(req.organizationId);
    res.json(orgTeams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single team by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const team = await teamService.getTeam(req.params.id);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Verify team belongs to user's organization
    if (team.organizationId !== req.organizationId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new team
router.post(
  '/',
  requirePermission({ resourceType: 'organization', action: 'write' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, description, settings } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Team name is required' });
      }

      const newTeam = await teamService.createTeam({
        organizationId: req.organizationId,
        name,
        description,
        settings,
      });

      res.status(201).json(newTeam);
    } catch (error) {
      console.error('Error creating team:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update a team
router.put(
  '/:id',
  requirePermission({ resourceType: 'organization', action: 'write' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const existingTeam = await teamService.getTeam(req.params.id);

      if (!existingTeam) {
        return res.status(404).json({ error: 'Team not found' });
      }

      if (existingTeam.organizationId !== req.organizationId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { name, description, settings } = req.body;

      const updatedTeam = await teamService.updateTeam(req.params.id, {
        name,
        description,
        settings,
      });

      if (!updatedTeam) {
        return res.status(404).json({ error: 'Team not found' });
      }

      res.json(updatedTeam);
    } catch (error) {
      console.error('Error updating team:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete a team
router.delete(
  '/:id',
  requirePermission({ resourceType: 'organization', action: 'write' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const existingTeam = await teamService.getTeam(req.params.id);

      if (!existingTeam) {
        return res.status(404).json({ error: 'Team not found' });
      }

      if (existingTeam.organizationId !== req.organizationId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await teamService.deleteTeam(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting team:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Add member to team
router.post(
  '/:id/members',
  requirePermission({ resourceType: 'organization', action: 'write' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId, roleId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const team = await teamService.getTeam(req.params.id);

      if (!team || team.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Team not found' });
      }

      // Verify user is a member of the organization
      const [member] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, req.organizationId)
          )
        )
        .limit(1);

      if (!member) {
        return res.status(400).json({ error: 'User is not a member of the organization' });
      }

      const newMember = await teamService.addMember(req.params.id, userId, roleId);
      res.status(201).json(newMember);
    } catch (error: any) {
      console.error('Error adding team member:', error);
      if (error.message === 'User is already a member of this team') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Remove member from team
router.delete(
  '/:id/members/:userId',
  requirePermission({ resourceType: 'organization', action: 'write' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const team = await teamService.getTeam(req.params.id);

      if (!team || team.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Team not found' });
      }

      await teamService.removeMember(req.params.id, req.params.userId);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing team member:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;

