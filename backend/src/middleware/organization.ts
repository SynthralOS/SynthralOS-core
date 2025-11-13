import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { db } from '../config/database';
import { organizationMembers, organizations } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

/**
 * Middleware to set organizationId on the request
 * Gets the user's first organization (or creates a default one if needed)
 */
export const setOrganization = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user's organization memberships
    const memberships = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, req.user.id))
      .limit(1);

    if (memberships.length === 0) {
      // User has no organization - create a default one
      const uniqueSlug = `org-${req.user.id.replace(/[^a-zA-Z0-9]/g, '')}`;
      
      // Check if slug already exists (handle race condition)
      const [existingOrg] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, uniqueSlug))
        .limit(1);
      
      let organizationId: string;

      if (existingOrg) {
        // If exists, check if user is already a member
        const [existingMember] = await db
          .select()
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, req.user.id),
              eq(organizationMembers.organizationId, existingOrg.id)
            )
          )
          .limit(1);
        
        if (existingMember) {
          organizationId = existingOrg.id;
        } else {
          // Add user to existing org
          await db.insert(organizationMembers).values({
            userId: req.user.id,
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
            id: createId(),
            name: 'My Organization',
            slug: uniqueSlug,
            plan: 'free',
          })
          .returning();

        // Add user as owner
        await db.insert(organizationMembers).values({
          userId: req.user.id,
          organizationId: org.id,
          role: 'owner',
        });

        organizationId = org.id;
      }

      req.organizationId = organizationId;
      next();
      return;
    }

    // Set the first organization as the default
    req.organizationId = memberships[0].organizationId;
    next();
  } catch (error) {
    console.error('Error setting organization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

