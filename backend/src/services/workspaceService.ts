import { db } from '../config/database';
import { workspaces, organizations, organizationMembers } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

/**
 * Get or create a default workspace for a user
 */
export async function getOrCreateDefaultWorkspace(userId: string): Promise<string> {
  // First, try to find user's organization
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);

  let organizationId: string;

  if (member) {
    organizationId = member.organizationId;
  } else {
    // Create a default organization for the user
    // Use full userId to ensure uniqueness
    const uniqueSlug = `org-${userId.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    // Check if slug already exists (handle race condition)
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, uniqueSlug))
      .limit(1);
    
    if (existingOrg) {
      // If exists, check if user is already a member
      const [existingMember] = await db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, existingOrg.id)
          )
        )
        .limit(1);
      
      if (existingMember) {
        organizationId = existingOrg.id;
      } else {
        // Add user to existing org
        await db.insert(organizationMembers).values({
          userId,
          organizationId: existingOrg.id,
          role: 'owner',
        });
        organizationId = existingOrg.id;
      }
    } else {
      // Create new organization
      const [org] = await db
        .insert(organizations)
        .values({
          name: 'My Organization',
          slug: uniqueSlug,
          plan: 'free',
        })
        .returning();

      // Add user as owner
      await db.insert(organizationMembers).values({
        userId,
        organizationId: org.id,
        role: 'owner',
      });

      organizationId = org.id;
    }
  }

  // Try to find existing default workspace
  const [existingWorkspace] = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.organizationId, organizationId),
        eq(workspaces.slug, 'default')
      )
    )
    .limit(1);

  if (existingWorkspace) {
    return existingWorkspace.id;
  }

  // Create default workspace
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: 'Default Workspace',
      slug: 'default',
      organizationId,
    })
    .returning();

  return workspace.id;
}

