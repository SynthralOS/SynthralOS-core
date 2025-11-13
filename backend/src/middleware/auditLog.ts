import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { auditService } from '../services/auditService';

/**
 * List of sensitive field names that should be removed from audit logs
 * These fields may contain passwords, tokens, API keys, or other sensitive data
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwd',
  'pwd',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'apikey',
  'secret',
  'secretKey',
  'secret_key',
  'authorization',
  'auth',
  'credentials',
  'privateKey',
  'private_key',
  'sessionId',
  'session_id',
  'cookie',
  'cookies',
  'ssn',
  'socialSecurityNumber',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'pin',
  'otp',
  'verificationCode',
  'verification_code',
];

/**
 * Recursively sanitize an object by removing sensitive fields
 * @param obj - The object to sanitize
 * @param depth - Current recursion depth (to prevent infinite loops)
 * @returns Sanitized object
 */
function sanitizeObject(obj: unknown, depth = 0): unknown {
  // Prevent deep recursion
  if (depth > 10) {
    return '[Max depth reached]';
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this is a sensitive field
    const isSensitive = SENSITIVE_FIELDS.some((field) => 
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      // Replace sensitive field with masked value
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      // Keep non-sensitive primitive values
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize request body to remove sensitive information
 * @param body - The request body to sanitize
 * @returns Sanitized request body
 */
function sanitizeRequestBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') {
    return body;
  }

  return sanitizeObject(body);
}

/**
 * Middleware to automatically log API requests
 * Should be applied after authentication middleware
 */
export const auditLogMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Store original end function
  const originalEnd = res.end;

  // Override end to log after response is sent
  res.end = function (chunk?: unknown, encoding?: unknown) {
    // Restore original end
    res.end = originalEnd;

    // Call original end
    res.end(chunk, encoding);

    // Log audit event asynchronously (don't block response)
    setImmediate(() => {
      try {
        const method = req.method;
        const path = req.path;
        const statusCode = res.statusCode;

        // Only log successful operations (2xx, 3xx) and important errors (4xx, 5xx)
        if (statusCode >= 200 && statusCode < 600) {
          // Determine action and resource type from path
          const pathParts = path.split('/').filter(Boolean);
          const resourceType = pathParts[1] || 'unknown';
          const resourceId = pathParts[2] || undefined;

          // Map HTTP methods to actions
          let action = '';
          if (method === 'POST') {
            action = 'create';
          } else if (method === 'PUT' || method === 'PATCH') {
            action = 'update';
          } else if (method === 'DELETE') {
            action = 'delete';
          } else if (method === 'GET') {
            // Only log GET for specific resources, not list endpoints
            if (resourceId) {
              action = 'read';
            } else {
              // Skip logging list GET requests to avoid noise
              return;
            }
          } else {
            // Skip other methods
            return;
          }

          // Extract organization ID from request if available
          const organizationId = req.organizationId || undefined;

          // Get IP address and user agent
          const ipAddress =
            (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
            (req.headers['x-real-ip'] as string) ||
            req.socket.remoteAddress ||
            undefined;
          const userAgent = req.headers['user-agent'] || undefined;

          // Sanitize request body to remove sensitive information
          const sanitizedRequestBody = req.body && Object.keys(req.body).length > 0
            ? sanitizeRequestBody(req.body)
            : undefined;

          // Log the action
          auditService.log({
            userId: req.user?.id,
            organizationId,
            action: `${resourceType}.${action}`,
            resourceType,
            resourceId,
            details: {
              method,
              path,
              statusCode,
              ...(sanitizedRequestBody ? { requestBody: sanitizedRequestBody } : {}),
            },
            ipAddress,
            userAgent,
          });
        }
      } catch (error) {
        // Don't throw - audit logging should not break the application
        console.error('Error in audit log middleware:', error);
      }
    });
  };

  next();
};

