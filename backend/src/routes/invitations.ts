import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { requirePermission } from '../middleware/permissions';
import { invitationService } from '../services/invitationService';
import { db } from '../config/database';
import { invitations, organizationMembers } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

// All routes require authentication except token lookup
router.use(authenticate);
router.use(auditLogMiddleware);

// Get invitation by token (public route - no organization needed)
router.get('/token/:token', async (req, res) => {
  try {
    const invitation = await invitationService.getInvitationByToken(req.params.token);
    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }
    res.json(invitation);
  } catch (error) {
    console.error('Error fetching invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// All other routes need organization
router.use(setOrganization);

// Get all invitations for organization
router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const orgInvitations = await invitationService.getInvitations(req.organizationId);
    res.json(orgInvitations);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create and send an invitation
router.post(
  '/',
  requirePermission({ resourceType: 'organization', action: 'admin' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { email, workspaceId, teamId, roleId, expiresInDays } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const newInvitation = await invitationService.createInvitation({
        organizationId: req.organizationId,
        email,
        workspaceId,
        teamId,
        roleId,
        invitedBy: req.user.id,
        expiresInDays,
      });

      res.status(201).json(newInvitation);
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      if (error.message.includes('already')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Accept an invitation (needs auth but not organization)
router.post('/accept', async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    await invitationService.acceptInvitation(token, req.user.id);
    res.json({ success: true, message: 'Invitation accepted successfully' });
  } catch (error: any) {
    console.error('Error accepting invitation:', error);
    res.status(400).json({ error: error.message || 'Error accepting invitation' });
  }
});

// Cancel an invitation
router.delete(
  '/:id',
  requirePermission({ resourceType: 'organization', action: 'admin' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, req.params.id))
        .limit(1);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (invitation.organizationId !== req.organizationId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await invitationService.cancelInvitation(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error canceling invitation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Resend invitation email
router.post(
  '/:id/resend',
  requirePermission({ resourceType: 'organization', action: 'admin' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, req.params.id))
        .limit(1);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (invitation.organizationId !== req.organizationId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await invitationService.resendInvitation(req.params.id);
      res.json({ success: true, message: 'Invitation email resent' });
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      res.status(400).json({ error: error.message || 'Error resending invitation' });
    }
  }
);

export default router;

