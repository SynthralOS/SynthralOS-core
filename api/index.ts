// Vercel Serverless Function Entry Point
// This file handles all API routes using Express app

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import all routes
import workflowsRouter from '../backend/src/routes/workflows';
import authRouter from '../backend/src/routes/auth';
import executionsRouter from '../backend/src/routes/executions';
import webhooksRouter from '../backend/src/routes/webhooks';
import statsRouter from '../backend/src/routes/stats';
import templatesRouter from '../backend/src/routes/templates';
import analyticsRouter from '../backend/src/routes/analytics';
import alertsRouter from '../backend/src/routes/alerts';
import rolesRouter from '../backend/src/routes/roles';
import teamsRouter from '../backend/src/routes/teams';
import invitationsRouter from '../backend/src/routes/invitations';
import usersRouter from '../backend/src/routes/users';
import apiKeysRouter from '../backend/src/routes/apiKeys';
import auditLogsRouter from '../backend/src/routes/auditLogs';
import emailOAuthRouter from '../backend/src/routes/emailOAuth';
import emailTriggerMonitoringRouter from '../backend/src/routes/emailTriggerMonitoring';
import performanceMonitoringRouter from '../backend/src/routes/performanceMonitoring';
import agentsRouter from '../backend/src/routes/agents';
import observabilityRouter from '../backend/src/routes/observability';
import osintRouter from '../backend/src/routes/osint';
import connectorsRouter from '../backend/src/routes/connectors';
import nangoRouter from '../backend/src/routes/nango';
import earlyAccessRouter from '../backend/src/routes/earlyAccess';
import contactRouter from '../backend/src/routes/contact';
import codeAgentsRouter from '../backend/src/routes/codeAgents';
import codeExecLogsRouter from '../backend/src/routes/codeExecLogs';
import policiesRouter from '../backend/src/routes/policies';
import { swaggerSpec } from '../backend/src/config/swagger';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from '../backend/src/utils/errorHandler';
import { performanceMiddleware } from '../backend/src/services/performanceMonitoring';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*'),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Performance monitoring
app.use(performanceMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    platform: 'vercel',
    version: '1.0.0'
  });
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SynthralOS Automation Platform API Documentation',
}));

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/workflows', workflowsRouter);
app.use('/api/v1/executions', executionsRouter);
app.use('/api/v1/stats', statsRouter);
app.use('/api/v1/templates', templatesRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/alerts', alertsRouter);
app.use('/api/v1/roles', rolesRouter);
app.use('/api/v1/teams', teamsRouter);
app.use('/api/v1/invitations', invitationsRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/api-keys', apiKeysRouter);
app.use('/api/v1/audit-logs', auditLogsRouter);
app.use('/api/v1/email-oauth', emailOAuthRouter);
app.use('/api/v1/email-triggers/monitoring', emailTriggerMonitoringRouter);
app.use('/api/v1/monitoring/performance', performanceMonitoringRouter);
app.use('/api/v1/agents', agentsRouter);
app.use('/api/v1/observability', observabilityRouter);
app.use('/api/v1/osint', osintRouter);
app.use('/api/v1/connectors', connectorsRouter);
app.use('/api/v1/nango', nangoRouter);
app.use('/api/v1/early-access', earlyAccessRouter);
app.use('/api/v1/contact', contactRouter);
app.use('/api/v1/code-agents', codeAgentsRouter);
app.use('/api/v1/code-exec-logs', codeExecLogsRouter);
app.use('/api/v1/policies', policiesRouter);
app.use('/webhooks', webhooksRouter);

app.get('/api/v1', (req, res) => {
  res.json({ 
    message: 'SynthralOS Automation Platform API v1', 
    platform: 'vercel',
    websockets: 'not-supported-use-polling',
    backgroundJobs: 'use-vercel-cron-or-external-service'
  });
});

// Error handling
app.use(errorHandler);

// Export for Vercel serverless
export default app;
