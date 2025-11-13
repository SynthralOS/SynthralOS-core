import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '../config/clerk';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    [key: string]: unknown;
  };
  organizationId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' });
      }
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

      // Get user details from Clerk
      const user = await clerkClient.users.getUser(jwt.sub);

      req.user = {
        id: user.id,
        email: user.emailAddresses?.[0]?.emailAddress || '',
        name: user.firstName || user.username || undefined,
        ...user.publicMetadata,
      };

      next();
    } catch (error: any) {
      console.error('Clerk token verification error:', error);
      // Don't send 500 for invalid tokens - return 401 instead
      if (!res.headersSent) {
        res.status(401).json({ error: 'Invalid token', details: error.message });
      }
      return;
    }
  } catch (error: any) {
    console.error('Auth error:', error);
    // Ensure we don't send multiple responses
    if (!res.headersSent) {
      res.status(401).json({ error: 'Authentication failed', details: error.message });
    }
  }
};
