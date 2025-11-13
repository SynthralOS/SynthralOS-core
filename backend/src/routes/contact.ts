import { Router } from 'express';
import { db } from '../config/database';
import { contactSubmissions } from '../../drizzle/schema';
import { z } from 'zod';
import { auditLogMiddleware } from '../middleware/auditLog';

const router = Router();

// Apply audit logging
router.use(auditLogMiddleware);

const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().min(1),
  message: z.string().min(1),
});

// Submit contact form (public endpoint)
router.post('/', async (req, res) => {
  try {
    const validated = ContactSchema.parse(req.body);

    // Create new contact submission
    const [submission] = await db
      .insert(contactSubmissions)
      .values({
        name: validated.name,
        email: validated.email,
        subject: validated.subject,
        message: validated.message,
        status: 'new',
      })
      .returning();

    res.status(201).json({
      message: 'Thank you for contacting us! We\'ll get back to you soon.',
      submission: {
        id: submission.id,
        status: submission.status,
        createdAt: submission.createdAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating contact submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

