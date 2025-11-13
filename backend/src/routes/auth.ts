import { Router } from 'express';
import { clerkClient } from '../config/clerk';
import { db } from '../config/database';
import { users } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Note: With Clerk, registration and login are handled on the frontend
// These endpoints are for syncing Clerk users with our database

// Sync user from Clerk (called after Clerk signup/login)
router.post('/sync', async (req, res) => {
  try {
    const { clerkUserId, email, name } = req.body;

    if (!clerkUserId || !email) {
      res.status(400).json({ error: 'clerkUserId and email are required' });
      return;
    }

    // Check if user exists in our database
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, clerkUserId))
      .limit(1);

    if (existingUser) {
      // Update user if needed
      const [updatedUser] = await db
        .update(users)
        .set({
          email,
          name: name || existingUser.name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, clerkUserId))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
        });

      res.json({ user: updatedUser });
      return;
    }

    // Create new user in our database
    const [newUser] = await db
      .insert(users)
      .values({
        id: clerkUserId,
        email,
        name: name || undefined,
        emailVerified: true, // Clerk handles email verification
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      });

    res.status(201).json({ user: newUser });
  } catch (error: any) {
    console.error('Error syncing user:', error);
    
    if (error.code === '23505' || error.message?.includes('unique')) {
      // User already exists, fetch and return
      try {
        const [user] = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.id, req.body.clerkUserId))
          .limit(1);

        if (user) {
          res.json({ user });
          return;
        }
      } catch (dbError) {
        console.error('Error fetching existing user:', dbError);
      }
    }

    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token with Clerk
    try {
      const jwt = await clerkClient.verifyToken(token);
      
      if (!jwt || !jwt.sub) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      // Get user from our database
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          avatar: users.avatar,
          emailVerified: users.emailVerified,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, jwt.sub))
        .limit(1);

      if (!user) {
        // User exists in Clerk but not in our DB - sync it
        const clerkUser = await clerkClient.users.getUser(jwt.sub);
        const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
        
        const [newUser] = await db
          .insert(users)
          .values({
            id: jwt.sub,
            email,
            name: clerkUser.firstName || clerkUser.username || undefined,
            emailVerified: true,
          })
          .returning({
            id: users.id,
            email: users.email,
            name: users.name,
            avatar: users.avatar,
            emailVerified: users.emailVerified,
            createdAt: users.createdAt,
          });

        res.json(newUser);
        return;
      }

      res.json(user);
    } catch (error: any) {
      console.error('Clerk token verification error:', error);
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
