import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { db } from '../config/database';
import { users, auditLogs } from '../../drizzle/schema';
import { eq, desc, and, gte, lte, like, or } from 'drizzle-orm';
import { z } from 'zod';
import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

// Apply audit logging to all routes
router.use(auditLogMiddleware);

// Update profile schema
const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatar: z.string().url().optional().or(z.string().startsWith('data:image/').optional()),
});

// Update preferences schema
const UpdatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    inApp: z.boolean().optional(),
    workflowCompleted: z.boolean().optional(),
    workflowFailed: z.boolean().optional(),
    alertTriggered: z.boolean().optional(),
  }).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
}).passthrough(); // Allow additional fields

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        emailVerified: users.emailVerified,
        preferences: users.preferences,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validated = UpdateProfileSchema.parse(req.body);

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (validated.name !== undefined) {
      updateData.name = validated.name;
    }

    if (validated.avatar !== undefined) {
      // Handle base64 image data
      if (validated.avatar.startsWith('data:image/')) {
        // For now, store as base64 data URL
        // In production, you might want to:
        // 1. Upload to S3/Cloudinary/etc.
        // 2. Store the URL instead
        updateData.avatar = validated.avatar;
      } else {
        // Store as URL
        updateData.avatar = validated.avatar;
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, req.user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        emailVerified: users.emailVerified,
        preferences: users.preferences,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user profile:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload avatar (handles multipart/form-data file upload or base64)
router.post('/me/avatar', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let avatarUrl: string;

    // Check if it's a file upload (multipart/form-data)
    if (req.body && typeof req.body === 'object' && 'avatar' in req.body) {
      // Handle base64 or URL from JSON body
      const { avatar } = req.body;
      if (!avatar) {
        res.status(400).json({ error: 'Avatar is required' });
        return;
      }

      // Validate avatar format (base64 data URL or regular URL)
      const avatarSchema = z.string().refine(
        (val) => val.startsWith('data:image/') || z.string().url().safeParse(val).success,
        { message: 'Avatar must be a valid image data URL or URL' }
      );

      avatarUrl = avatarSchema.parse(avatar);
    } else {
      // For multipart/form-data, we'd need multer or similar
      // For now, accept base64 in body or convert file to base64
      // In production, upload to S3/Cloudinary and store URL
      res.status(400).json({ 
        error: 'Avatar upload requires base64 data URL. Send as JSON: { "avatar": "data:image/..." }' 
      });
      return;
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        avatar: avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        emailVerified: users.emailVerified,
        preferences: users.preferences,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error uploading avatar:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user preferences
router.get('/me/preferences', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [user] = await db
      .select({
        preferences: users.preferences,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ preferences: user.preferences || {} });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user preferences
router.put('/me/preferences', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validated = UpdatePreferencesSchema.parse(req.body);

    // Get current preferences
    const [currentUser] = await db
      .select({
        preferences: users.preferences,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!currentUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Merge with existing preferences
    const currentPreferences = (currentUser.preferences as Record<string, unknown>) || {};
    const updatedPreferences = {
      ...currentPreferences,
      ...validated,
    };

    const [updatedUser] = await db
      .update(users)
      .set({
        preferences: updatedPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        avatar: users.avatar,
        emailVerified: users.emailVerified,
        preferences: users.preferences,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user preferences:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user activity logs
router.get('/me/activity', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Extract query parameters
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const action = req.query.action as string | undefined;
    const resourceType = req.query.resourceType as string | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    // Build where conditions
    const conditions = [eq(auditLogs.userId, req.user.id)];

    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    if (action) {
      conditions.push(like(auditLogs.action, `%${action}%`));
    }

    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }

    // Get activity logs
    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const allLogs = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions));
    
    const total = allLogs.length;

    res.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching user activity logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

