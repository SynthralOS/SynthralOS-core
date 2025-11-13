import { db } from '../config/database';
import { roles, permissions, rolePermissions, organizationMembers } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export interface RoleConfig {
  organizationId: string;
  name: string;
  description?: string;
  permissionIds?: string[];
  isSystem?: boolean;
}

export class RoleService {
  /**
   * Create a new role
   */
  async createRole(config: RoleConfig): Promise<typeof roles.$inferSelect> {
    const [newRole] = await db
      .insert(roles)
      .values({
        id: createId(),
        organizationId: config.organizationId,
        name: config.name,
        description: config.description,
        isSystem: config.isSystem || false,
      })
      .returning();

    // Assign permissions if provided
    if (config.permissionIds && config.permissionIds.length > 0) {
      await this.assignPermissionsToRole(newRole.id, config.permissionIds);
    }

    return newRole;
  }

  /**
   * Get all roles for an organization
   */
  async getRoles(organizationId: string): Promise<(typeof roles.$inferSelect & { permissions: typeof permissions.$inferSelect[] })[]> {
    const orgRoles = await db
      .select()
      .from(roles)
      .where(eq(roles.organizationId, organizationId));

    // Get permissions for each role
    const rolesWithPermissions = await Promise.all(
      orgRoles.map(async (role) => {
        const rolePerms = await db
          .select({
            id: permissions.id,
            resourceType: permissions.resourceType,
            action: permissions.action,
            name: permissions.name,
            description: permissions.description,
          })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
          .where(eq(rolePermissions.roleId, role.id));

        return {
          ...role,
          permissions: rolePerms,
        };
      })
    );

    return rolesWithPermissions;
  }

  /**
   * Get a single role by ID
   */
  async getRole(roleId: string): Promise<(typeof roles.$inferSelect & { permissions: typeof permissions.$inferSelect[] }) | undefined> {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    if (!role) return undefined;

    const rolePerms = await db
      .select({
        id: permissions.id,
        resourceType: permissions.resourceType,
        action: permissions.action,
        name: permissions.name,
        description: permissions.description,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, role.id));

    return {
      ...role,
      permissions: rolePerms,
    };
  }

  /**
   * Update a role
   */
  async updateRole(
    roleId: string,
    updates: {
      name?: string;
      description?: string;
      permissionIds?: string[];
    }
  ): Promise<typeof roles.$inferSelect | undefined> {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    if (!role) return undefined;

    // Update role fields
    const updateData: Partial<typeof roles.$inferInsert> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    updateData.updatedAt = new Date();

    const [updatedRole] = await db
      .update(roles)
      .set(updateData)
      .where(eq(roles.id, roleId))
      .returning();

    // Update permissions if provided
    if (updates.permissionIds !== undefined) {
      // Remove all existing permissions
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

      // Add new permissions
      if (updates.permissionIds.length > 0) {
        await this.assignPermissionsToRole(roleId, updates.permissionIds);
      }
    }

    return updatedRole;
  }

  /**
   * Delete a role
   */
  async deleteRole(roleId: string): Promise<boolean> {
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);

    if (!role) return false;

    // Cannot delete system roles
    if (role.isSystem) {
      throw new Error('Cannot delete system role');
    }

    // Check if role is assigned to any members
    const [member] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.roleId, roleId))
      .limit(1);

    if (member) {
      throw new Error('Cannot delete role that is assigned to members');
    }

    await db.delete(roles).where(eq(roles.id, roleId));
    return true;
  }

  /**
   * Assign permissions to a role
   */
  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    if (permissionIds.length === 0) return;

    const values = permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    }));

    await db.insert(rolePermissions).values(values);
  }

  /**
   * Remove a permission from a role
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionId)
        )
      );
  }

  /**
   * Get all available permissions
   */
  async getAllPermissions(): Promise<typeof permissions.$inferSelect[]> {
    return db.select().from(permissions);
  }

  /**
   * Get permissions grouped by resource type
   */
  async getPermissionsGrouped(): Promise<Record<string, typeof permissions.$inferSelect[]>> {
    const allPermissions = await this.getAllPermissions();
    
    const grouped: Record<string, typeof permissions.$inferSelect[]> = {};
    for (const perm of allPermissions) {
      if (!grouped[perm.resourceType]) {
        grouped[perm.resourceType] = [];
      }
      grouped[perm.resourceType].push(perm);
    }

    return grouped;
  }
}

export const roleService = new RoleService();

