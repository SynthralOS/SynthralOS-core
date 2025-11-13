import { db } from '../config/database';
import { roles, permissions, rolePermissions, organizationMembers } from '../../drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';

export interface Permission {
  resourceType: string;
  action: string;
}

export class PermissionService {
  /**
   * Check if a user has a specific permission
   */
  async hasPermission(
    userId: string,
    organizationId: string,
    permission: Permission
  ): Promise<boolean> {
    // Get user's organization membership
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!member) return false;

    // If user has a custom role, check its permissions
    if (member.roleId) {
      const hasCustomPermission = await this.checkRolePermission(
        member.roleId,
        permission
      );
      if (hasCustomPermission) return true;
    }

    // Check legacy enum role permissions
    return this.checkLegacyRolePermission(member.role, permission);
  }

  /**
   * Check if a role has a specific permission
   */
  async checkRolePermission(
    roleId: string,
    permission: Permission
  ): Promise<boolean> {
    const [permissionRecord] = await db
      .select()
      .from(permissions)
      .where(
        and(
          eq(permissions.resourceType, permission.resourceType),
          eq(permissions.action, permission.action)
        )
      )
      .limit(1);

    if (!permissionRecord) return false;

    const [rolePermission] = await db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionRecord.id)
        )
      )
      .limit(1);

    return !!rolePermission;
  }

  /**
   * Check legacy enum role permissions
   */
  private checkLegacyRolePermission(
    role: string,
    permission: Permission
  ): boolean {
    // Owner has all permissions
    if (role === 'owner') return true;

    // Admin has most permissions except organization admin
    if (role === 'admin') {
      if (permission.resourceType === 'organization' && permission.action === 'admin') {
        return false;
      }
      return true;
    }

    // Developer can read, write, execute workflows
    if (role === 'developer') {
      if (permission.resourceType === 'workflow') {
        return ['read', 'write', 'execute'].includes(permission.action);
      }
      if (permission.resourceType === 'workspace') {
        return ['read', 'write'].includes(permission.action);
      }
      return permission.action === 'read';
    }

    // Viewer can only read
    if (role === 'viewer') {
      return permission.action === 'read';
    }

    // Guest has minimal permissions
    if (role === 'guest') {
      return (
        permission.resourceType === 'workflow' &&
        permission.action === 'read'
      );
    }

    // Member has read and execute permissions
    if (role === 'member') {
      if (permission.resourceType === 'workflow') {
        return ['read', 'execute'].includes(permission.action);
      }
      return permission.action === 'read';
    }

    return false;
  }

  /**
   * Get all permissions for a user in an organization
   */
  async getUserPermissions(
    userId: string,
    organizationId: string
  ): Promise<Permission[]> {
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!member) return [];

    const permissionsList: Permission[] = [];

    // Get custom role permissions
    if (member.roleId) {
      const rolePerms = await this.getRolePermissions(member.roleId);
      permissionsList.push(...rolePerms);
    }

    // Get legacy role permissions
    const legacyPerms = this.getLegacyRolePermissions(member.role);
    permissionsList.push(...legacyPerms);

    // Remove duplicates
    const uniquePerms = Array.from(
      new Map(
        permissionsList.map((p) => [`${p.resourceType}:${p.action}`, p])
      ).values()
    );

    return uniquePerms;
  }

  /**
   * Get all permissions for a role
   */
  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const rolePerms = await db
      .select({
        resourceType: permissions.resourceType,
        action: permissions.action,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    return rolePerms;
  }

  /**
   * Get permissions for legacy enum roles
   */
  private getLegacyRolePermissions(role: string): Permission[] {
    const perms: Permission[] = [];

    if (role === 'owner') {
      // Owner has all permissions
      return [
        { resourceType: 'workflow', action: 'read' },
        { resourceType: 'workflow', action: 'write' },
        { resourceType: 'workflow', action: 'execute' },
        { resourceType: 'workflow', action: 'delete' },
        { resourceType: 'workspace', action: 'read' },
        { resourceType: 'workspace', action: 'write' },
        { resourceType: 'workspace', action: 'delete' },
        { resourceType: 'organization', action: 'read' },
        { resourceType: 'organization', action: 'write' },
        { resourceType: 'organization', action: 'admin' },
        { resourceType: 'alert', action: 'read' },
        { resourceType: 'alert', action: 'write' },
        { resourceType: 'alert', action: 'delete' },
      ];
    }

    if (role === 'admin') {
      return [
        { resourceType: 'workflow', action: 'read' },
        { resourceType: 'workflow', action: 'write' },
        { resourceType: 'workflow', action: 'execute' },
        { resourceType: 'workflow', action: 'delete' },
        { resourceType: 'workspace', action: 'read' },
        { resourceType: 'workspace', action: 'write' },
        { resourceType: 'workspace', action: 'delete' },
        { resourceType: 'organization', action: 'read' },
        { resourceType: 'organization', action: 'write' },
        { resourceType: 'alert', action: 'read' },
        { resourceType: 'alert', action: 'write' },
        { resourceType: 'alert', action: 'delete' },
      ];
    }

    if (role === 'developer') {
      return [
        { resourceType: 'workflow', action: 'read' },
        { resourceType: 'workflow', action: 'write' },
        { resourceType: 'workflow', action: 'execute' },
        { resourceType: 'workspace', action: 'read' },
        { resourceType: 'workspace', action: 'write' },
        { resourceType: 'organization', action: 'read' },
        { resourceType: 'alert', action: 'read' },
        { resourceType: 'alert', action: 'write' },
      ];
    }

    if (role === 'viewer') {
      return [
        { resourceType: 'workflow', action: 'read' },
        { resourceType: 'workspace', action: 'read' },
        { resourceType: 'organization', action: 'read' },
        { resourceType: 'alert', action: 'read' },
      ];
    }

    if (role === 'member') {
      return [
        { resourceType: 'workflow', action: 'read' },
        { resourceType: 'workflow', action: 'execute' },
        { resourceType: 'workspace', action: 'read' },
        { resourceType: 'organization', action: 'read' },
        { resourceType: 'alert', action: 'read' },
      ];
    }

    if (role === 'guest') {
      return [
        { resourceType: 'workflow', action: 'read' },
        { resourceType: 'organization', action: 'read' },
      ];
    }

    return perms;
  }

  /**
   * Initialize default permissions in the database
   */
  async initializeDefaultPermissions(): Promise<void> {
    const defaultPermissions = [
      // Workflow permissions
      { resourceType: 'workflow', action: 'read', name: 'View Workflows', description: 'Can view workflows' },
      { resourceType: 'workflow', action: 'write', name: 'Edit Workflows', description: 'Can create and edit workflows' },
      { resourceType: 'workflow', action: 'execute', name: 'Execute Workflows', description: 'Can execute workflows' },
      { resourceType: 'workflow', action: 'delete', name: 'Delete Workflows', description: 'Can delete workflows' },
      
      // Workspace permissions
      { resourceType: 'workspace', action: 'read', name: 'View Workspaces', description: 'Can view workspaces' },
      { resourceType: 'workspace', action: 'write', name: 'Edit Workspaces', description: 'Can create and edit workspaces' },
      { resourceType: 'workspace', action: 'delete', name: 'Delete Workspaces', description: 'Can delete workspaces' },
      
      // Organization permissions
      { resourceType: 'organization', action: 'read', name: 'View Organization', description: 'Can view organization details' },
      { resourceType: 'organization', action: 'write', name: 'Edit Organization', description: 'Can edit organization settings' },
      { resourceType: 'organization', action: 'admin', name: 'Admin Organization', description: 'Can manage organization and members' },
      
      // Alert permissions
      { resourceType: 'alert', action: 'read', name: 'View Alerts', description: 'Can view alerts' },
      { resourceType: 'alert', action: 'write', name: 'Edit Alerts', description: 'Can create and edit alerts' },
      { resourceType: 'alert', action: 'delete', name: 'Delete Alerts', description: 'Can delete alerts' },
    ];

    for (const perm of defaultPermissions) {
      const [existing] = await db
        .select()
        .from(permissions)
        .where(
          and(
            eq(permissions.resourceType, perm.resourceType),
            eq(permissions.action, perm.action)
          )
        )
        .limit(1);

      if (!existing) {
        await db.insert(permissions).values({
          id: `perm_${perm.resourceType}_${perm.action}`,
          resourceType: perm.resourceType,
          action: perm.action,
          name: perm.name,
          description: perm.description,
        });
      }
    }
  }
}

export const permissionService = new PermissionService();

