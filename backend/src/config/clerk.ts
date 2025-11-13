import { createClerkClient } from '@clerk/clerk-sdk-node';
import dotenv from 'dotenv';

// Load environment variables if not already loaded
dotenv.config();

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error('CLERK_SECRET_KEY environment variable is not set');
}

// Create Clerk client
export const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY || '';

