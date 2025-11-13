import { pgTable, text, timestamp, boolean, jsonb, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// Enums
export const planEnum = pgEnum('plan', ['free', 'pro', 'team', 'enterprise']);
export const roleEnum = pgEnum('role', ['owner', 'admin', 'developer', 'viewer', 'guest', 'member']);
export const executionStatusEnum = pgEnum('execution_status', ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled']);
export const logLevelEnum = pgEnum('log_level', ['info', 'warn', 'error', 'debug']);

// Users table (Note: Supabase Auth handles authentication, this is for additional user data)
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  emailVerified: boolean('email_verified').default(false),
  preferences: jsonb('preferences'), // User preferences (theme, notifications, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  organizationMembers: many(organizationMembers),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLogs),
  teamMembers: many(teamMembers),
  sentInvitations: many(invitations),
}));

// Organizations
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: planEnum('plan').default('free').notNull(),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  workspaces: many(workspaces),
  apiKeys: many(apiKeys),
  roles: many(roles),
  alerts: many(alerts),
  teams: many(teams),
  invitations: many(invitations),
}));

// Organization Members
export const organizationMembers = pgTable('organization_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: roleEnum('role').default('member').notNull(), // Legacy enum role (for backward compatibility)
  roleId: text('role_id').references(() => roles.id, { onDelete: 'set null' }), // Custom role reference
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  customRole: one(roles, {
    fields: [organizationMembers.roleId],
    references: [roles.id],
  }),
}));

// Workspaces
export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workspaces.organizationId],
    references: [organizations.id],
  }),
  workflows: many(workflows),
  invitations: many(invitations),
}));

// Workflows
export const workflows = pgTable('workflows', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  definition: jsonb('definition').notNull(),
  active: boolean('active').default(true).notNull(),
  settings: jsonb('settings'),
  tags: jsonb('tags').$type<string[]>().default([]), // Array of tag strings
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [workflows.workspaceId],
    references: [workspaces.id],
  }),
  versions: many(workflowVersions),
  executions: many(workflowExecutions),
  webhooks: many(webhookRegistry),
}));

// Webhook Registry
export const webhookRegistry = pgTable('webhook_registry', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  method: text('method').default('POST').notNull(),
  nodeId: text('node_id').notNull(), // ID of the webhook trigger node
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const webhookRegistryRelations = relations(webhookRegistry, ({ one }) => ({
  workflow: one(workflows, {
    fields: [webhookRegistry.workflowId],
    references: [workflows.id],
  }),
}));

// Workflow Versions
export const workflowVersions = pgTable('workflow_versions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  definition: jsonb('definition').notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workflowVersionsRelations = relations(workflowVersions, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowVersions.workflowId],
    references: [workflows.id],
  }),
}));

// Workflow Executions
export const workflowExecutions = pgTable('workflow_executions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  status: executionStatusEnum('status').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),
  metadata: jsonb('metadata'),
});

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [workflowExecutions.workflowId],
    references: [workflows.id],
  }),
  logs: many(executionLogs),
}));

// Execution Logs
export const executionLogs = pgTable('execution_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  executionId: text('execution_id').notNull().references(() => workflowExecutions.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  level: logLevelEnum('level').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const executionLogsRelations = relations(executionLogs, ({ one }) => ({
  execution: one(workflowExecutions, {
    fields: [executionLogs.executionId],
    references: [workflowExecutions.id],
  }),
}));

// Plugins
export const plugins = pgTable('plugins', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull(),
  author: text('author'),
  category: text('category'),
  config: jsonb('config'),
  code: text('code'),
  public: boolean('public').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// API Keys
export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  key: text('key').notNull().unique(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  permissions: jsonb('permissions'),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
}));

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  organizationId: text('organization_id'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Alert Types
export const alertTypeEnum = pgEnum('alert_type', ['failure', 'performance', 'usage', 'custom']);
export const alertStatusEnum = pgEnum('alert_status', ['active', 'inactive', 'triggered']);
export const notificationChannelEnum = pgEnum('notification_channel', ['email', 'slack', 'webhook']);

// Alerts
export const alerts = pgTable('alerts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  workflowId: text('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  type: alertTypeEnum('type').notNull(),
  status: alertStatusEnum('status').default('active').notNull(),
  conditions: jsonb('conditions').notNull(), // Alert conditions (e.g., { threshold: 100, operator: '>' })
  notificationChannels: jsonb('notification_channels').notNull(), // Array of channels with config
  enabled: boolean('enabled').default(true).notNull(),
  cooldownMinutes: integer('cooldown_minutes').default(60), // Prevent spam
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const alertsRelations = relations(alerts, ({ one }) => ({
  organization: one(organizations, {
    fields: [alerts.organizationId],
    references: [organizations.id],
  }),
  workflow: one(workflows, {
    fields: [alerts.workflowId],
    references: [workflows.id],
  }),
}));

// Alert History
export const alertHistory = pgTable('alert_history', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  alertId: text('alert_id').notNull().references(() => alerts.id, { onDelete: 'cascade' }),
  executionId: text('execution_id').references(() => workflowExecutions.id, { onDelete: 'set null' }),
  triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
  message: text('message').notNull(),
  details: jsonb('details'),
  notificationSent: boolean('notification_sent').default(false),
  notificationChannels: jsonb('notification_channels'), // Which channels were notified
});

export const alertHistoryRelations = relations(alertHistory, ({ one }) => ({
  alert: one(alerts, {
    fields: [alertHistory.alertId],
    references: [alerts.id],
  }),
  execution: one(workflowExecutions, {
    fields: [alertHistory.executionId],
    references: [workflowExecutions.id],
  }),
}));

// Roles (Custom roles for organizations)
export const roles = pgTable('roles', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(false).notNull(), // System roles cannot be deleted
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roles.organizationId],
    references: [organizations.id],
  }),
  permissions: many(rolePermissions),
  organizationMembers: many(organizationMembers),
}));

// Permissions (Permission definitions)
export const permissions = pgTable('permissions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  resourceType: text('resource_type').notNull(), // 'workflow', 'workspace', 'organization', 'alert', etc.
  action: text('action').notNull(), // 'read', 'write', 'execute', 'delete', 'admin'
  name: text('name').notNull(),
  description: text('description'),
});

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

// Role Permissions (Many-to-many relationship)
export const rolePermissions = pgTable('role_permissions', {
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: { primaryKey: { columns: [table.roleId, table.permissionId] } },
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

// Teams
export const teams = pgTable('teams', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
}));

// Team Members
export const teamMembers = pgTable('team_members', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: text('role_id').references(() => roles.id, { onDelete: 'set null' }),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [teamMembers.roleId],
    references: [roles.id],
  }),
}));

// Invitations
export const invitations = pgTable('invitations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  roleId: text('role_id').references(() => roles.id, { onDelete: 'set null' }),
  invitedBy: text('invited_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  workspace: one(workspaces, {
    fields: [invitations.workspaceId],
    references: [workspaces.id],
  }),
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  role: one(roles, {
    fields: [invitations.roleId],
    references: [roles.id],
  }),
  inviter: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

// Email Trigger Configurations
export const emailTriggers = pgTable('email_triggers', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(), // The trigger node ID in the workflow
  provider: text('provider').notNull(), // 'gmail', 'outlook', 'imap'
  email: text('email').notNull(), // Email address being monitored
  credentials: jsonb('credentials').notNull(), // Encrypted OAuth tokens or IMAP credentials
  folder: text('folder').default('INBOX'), // Email folder to monitor (for IMAP)
  lastCheckedAt: timestamp('last_checked_at'),
  lastMessageId: text('last_message_id'), // Last processed message ID
  active: boolean('active').default(true).notNull(),
  pollInterval: integer('poll_interval').default(60).notNull(), // Poll interval in seconds
  filters: jsonb('filters'), // Email filters (from, subject, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const emailTriggersRelations = relations(emailTriggers, ({ one }) => ({
  user: one(users, {
    fields: [emailTriggers.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [emailTriggers.organizationId],
    references: [organizations.id],
  }),
  workflow: one(workflows, {
    fields: [emailTriggers.workflowId],
    references: [workflows.id],
  }),
}));

// All exports are already above

