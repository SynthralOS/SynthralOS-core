import { Router } from 'express';
import { db } from '../config/database';
import { earlyAccessSignups } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

// Apply audit logging
router.use(auditLogMiddleware);

const EarlyAccessSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

// Submit early access signup (public endpoint)
router.post('/', async (req, res) => {
  try {
    const validated = EarlyAccessSchema.parse(req.body);

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(earlyAccessSignups)
      .where(eq(earlyAccessSignups.email, validated.email))
      .limit(1);

    if (existing) {
      return res.status(200).json({
        message: 'You are already on our early access list!',
        signup: existing,
      });
    }

    // Create new signup
    const [signup] = await db
      .insert(earlyAccessSignups)
      .values({
        email: validated.email,
        name: validated.name || null,
        status: 'pending',
      })
      .returning();

    res.status(201).json({
      message: 'Thank you for your interest! We\'ll be in touch soon.',
      signup: {
        id: signup.id,
        email: signup.email,
        status: signup.status,
        createdAt: signup.createdAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating early access signup:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

