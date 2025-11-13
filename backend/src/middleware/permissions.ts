import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { permissionService, Permission } from '../services/permissionService';

/**
 * Middleware to check if user has a specific permission
 */
export function requirePermission(permission: Permission) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const hasPermission = await permissionService.hasPermission(
        req.user.id,
        req.organizationId,
        permission
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You do not have permission to ${permission.action} ${permission.resourceType}`,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware factory for resource-specific permissions
 */
export function requireResourcePermission(
  resourceType: string,
  action: string
) {
  return requirePermission({ resourceType, action });
}

