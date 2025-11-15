import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { setOrganization } from '../middleware/organization';
import { requirePermission } from '../middleware/permissions';
import { roleService } from '../services/roleService';
import { permissionService } from '../services/permissionService';
import { db } from '../config/database';
import { roles, organizationMembers } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

// All routes require authentication and organization
router.use(authenticate);
router.use(setOrganization);
router.use(auditLogMiddleware);

// Get all roles for organization
router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has permission to view roles
    const hasPermission = await permissionService.hasPermission(
      req.user.id,
      req.organizationId,
      { resourceType: 'organization', action: 'read' }
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const orgRoles = await roleService.getRoles(req.organizationId);
    res.json(orgRoles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single role by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const role = await roleService.getRole(req.params.id);

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Verify role belongs to user's organization
    if (role.organizationId !== req.organizationId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(role);
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new role
router.post(
  '/',
  requirePermission({ resourceType: 'organization', action: 'admin' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, description, permissionIds } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Role name is required' });
      }

      const newRole = await roleService.createRole({
        organizationId: req.organizationId,
        name,
        description,
        permissionIds,
      });

      const roleWithPermissions = await roleService.getRole(newRole.id);
      res.status(201).json(roleWithPermissions);
    } catch (error) {
      console.error('Error creating role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Update a role
router.put(
  '/:id',
  requirePermission({ resourceType: 'organization', action: 'admin' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const existingRole = await roleService.getRole(req.params.id);

      if (!existingRole) {
        return res.status(404).json({ error: 'Role not found' });
      }

      if (existingRole.organizationId !== req.organizationId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Cannot update system roles
      if (existingRole.isSystem) {
        return res.status(400).json({ error: 'Cannot update system role' });
      }

      const { name, description, permissionIds } = req.body;

      const updatedRole = await roleService.updateRole(req.params.id, {
        name,
        description,
        permissionIds,
      });

      if (!updatedRole) {
        return res.status(404).json({ error: 'Role not found' });
      }

      const roleWithPermissions = await roleService.getRole(updatedRole.id);
      res.json(roleWithPermissions);
    } catch (error) {
      console.error('Error updating role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Delete a role
router.delete(
  '/:id',
  requirePermission({ resourceType: 'organization', action: 'admin' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const existingRole = await roleService.getRole(req.params.id);

      if (!existingRole) {
        return res.status(404).json({ error: 'Role not found' });
      }

      if (existingRole.organizationId !== req.organizationId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await roleService.deleteRole(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      if (error.message === 'Cannot delete system role') {
        return res.status(400).json({ error: error.message });
      }
      if (error.message === 'Cannot delete role that is assigned to members') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Get all available permissions
router.get('/permissions/all', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasPermission = await permissionService.hasPermission(
      req.user.id,
      req.organizationId,
      { resourceType: 'organization', action: 'read' }
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const permissions = await roleService.getPermissionsGrouped();
    res.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign role to organization member
router.post(
  '/:id/assign',
  requirePermission({ resourceType: 'organization', action: 'admin' }),
  async (req: AuthRequest, res) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { memberId, organizationMemberId } = req.body;
      const actualMemberId = memberId || organizationMemberId;

      if (!actualMemberId) {
        return res.status(400).json({ error: 'Member ID is required' });
      }

      const role = await roleService.getRole(req.params.id);

      if (!role || role.organizationId !== req.organizationId) {
        return res.status(404).json({ error: 'Role not found' });
      }

      // Verify member belongs to organization
      const [member] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.id, actualMemberId),
            eq(organizationMembers.organizationId, req.organizationId)
          )
        )
        .limit(1);

      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      // Update member's role
      await db
        .update(organizationMembers)
        .set({ roleId: role.id })
        .where(eq(organizationMembers.id, actualMemberId));

      res.json({ success: true });
    } catch (error) {
      console.error('Error assigning role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;

