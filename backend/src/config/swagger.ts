import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SynthralOS Automation Platform API',
      version: '1.0.0',
      description: `
# SynthralOS Automation Platform API

A comprehensive workflow automation and orchestration platform API.

## Features

- **Workflow Management**: Create, manage, and execute workflows
- **Code Agents**: Execute custom code in secure sandboxes
- **Analytics**: Track performance, costs, and usage metrics
- **Monitoring**: Monitor email triggers, performance, and OSINT sources
- **Team Management**: Manage teams, roles, and permissions
- **Audit Logging**: Track all system activities with detailed audit logs

## Authentication

All endpoints (except public ones) require Bearer token authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## Rate Limiting

API requests are rate-limited per organization. Check response headers for rate limit information.

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "error": "Error message",
  "details": "Optional additional details"
}
\`\`\`
      `,
      contact: {
        name: 'API Support',
        email: 'support@sos-automation.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000/api/v1',
        description: 'Development server',
      },
      {
        url: 'https://api.sos-automation.com/api/v1',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        Workflow: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            definition: { type: 'object' },
            active: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Execution: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            workflowId: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'paused'] },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
          },
        },
        Template: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            definition: { type: 'object' },
            isPublic: { type: 'boolean' },
            usageCount: { type: 'number' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string', nullable: true },
            userEmail: { type: 'string', nullable: true },
            userName: { type: 'string', nullable: true },
            organizationId: { type: 'string' },
            action: { type: 'string' },
            resourceType: { type: 'string' },
            resourceId: { type: 'string', nullable: true },
            details: { type: 'object', nullable: true },
            ipAddress: { type: 'string', nullable: true },
            userAgent: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            hasMore: { type: 'boolean' },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/index.ts'], // Paths to files containing OpenAPI definitions
};

export const swaggerSpec = swaggerJsdoc(options);

