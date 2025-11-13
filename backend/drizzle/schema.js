"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailTriggersRelations = exports.emailTriggers = exports.invitationsRelations = exports.invitations = exports.teamMembersRelations = exports.teamMembers = exports.teamsRelations = exports.teams = exports.rolePermissionsRelations = exports.rolePermissions = exports.permissionsRelations = exports.permissions = exports.rolesRelations = exports.roles = exports.alertHistoryRelations = exports.alertHistory = exports.alertsRelations = exports.alerts = exports.notificationChannelEnum = exports.alertStatusEnum = exports.alertTypeEnum = exports.auditLogsRelations = exports.auditLogs = exports.apiKeysRelations = exports.apiKeys = exports.plugins = exports.executionLogsRelations = exports.executionLogs = exports.workflowExecutionsRelations = exports.workflowExecutions = exports.workflowVersionsRelations = exports.workflowVersions = exports.webhookRegistryRelations = exports.webhookRegistry = exports.workflowsRelations = exports.workflows = exports.workspacesRelations = exports.workspaces = exports.organizationMembersRelations = exports.organizationMembers = exports.organizationsRelations = exports.organizations = exports.usersRelations = exports.users = exports.logLevelEnum = exports.executionStatusEnum = exports.roleEnum = exports.planEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const cuid2_1 = require("@paralleldrive/cuid2");
// Enums
exports.planEnum = (0, pg_core_1.pgEnum)('plan', ['free', 'pro', 'team', 'enterprise']);
exports.roleEnum = (0, pg_core_1.pgEnum)('role', ['owner', 'admin', 'developer', 'viewer', 'guest', 'member']);
exports.executionStatusEnum = (0, pg_core_1.pgEnum)('execution_status', ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled']);
exports.logLevelEnum = (0, pg_core_1.pgEnum)('log_level', ['info', 'warn', 'error', 'debug']);
// Users table (Note: Supabase Auth handles authentication, this is for additional user data)
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    email: (0, pg_core_1.text)('email').notNull().unique(),
    name: (0, pg_core_1.text)('name'),
    avatar: (0, pg_core_1.text)('avatar'),
    emailVerified: (0, pg_core_1.boolean)('email_verified').default(false),
    preferences: (0, pg_core_1.jsonb)('preferences'), // User preferences (theme, notifications, etc.)
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    organizationMembers: many(exports.organizationMembers),
    apiKeys: many(exports.apiKeys),
    auditLogs: many(exports.auditLogs),
    teamMembers: many(exports.teamMembers),
    sentInvitations: many(exports.invitations),
}));
// Organizations
exports.organizations = (0, pg_core_1.pgTable)('organizations', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    name: (0, pg_core_1.text)('name').notNull(),
    slug: (0, pg_core_1.text)('slug').notNull().unique(),
    plan: (0, exports.planEnum)('plan').default('free').notNull(),
    settings: (0, pg_core_1.jsonb)('settings'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.organizationsRelations = (0, drizzle_orm_1.relations)(exports.organizations, ({ many }) => ({
    members: many(exports.organizationMembers),
    workspaces: many(exports.workspaces),
    apiKeys: many(exports.apiKeys),
    roles: many(exports.roles),
    alerts: many(exports.alerts),
    teams: many(exports.teams),
    invitations: many(exports.invitations),
}));
// Organization Members
exports.organizationMembers = (0, pg_core_1.pgTable)('organization_members', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    userId: (0, pg_core_1.text)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    organizationId: (0, pg_core_1.text)('organization_id').notNull().references(() => exports.organizations.id, { onDelete: 'cascade' }),
    role: (0, exports.roleEnum)('role').default('member').notNull(), // Legacy enum role (for backward compatibility)
    roleId: (0, pg_core_1.text)('role_id').references(() => exports.roles.id, { onDelete: 'set null' }), // Custom role reference
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.organizationMembersRelations = (0, drizzle_orm_1.relations)(exports.organizationMembers, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.organizationMembers.userId],
        references: [exports.users.id],
    }),
    organization: one(exports.organizations, {
        fields: [exports.organizationMembers.organizationId],
        references: [exports.organizations.id],
    }),
    customRole: one(exports.roles, {
        fields: [exports.organizationMembers.roleId],
        references: [exports.roles.id],
    }),
}));
// Workspaces
exports.workspaces = (0, pg_core_1.pgTable)('workspaces', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    name: (0, pg_core_1.text)('name').notNull(),
    slug: (0, pg_core_1.text)('slug').notNull(),
    organizationId: (0, pg_core_1.text)('organization_id').notNull().references(() => exports.organizations.id, { onDelete: 'cascade' }),
    settings: (0, pg_core_1.jsonb)('settings'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.workspacesRelations = (0, drizzle_orm_1.relations)(exports.workspaces, ({ one, many }) => ({
    organization: one(exports.organizations, {
        fields: [exports.workspaces.organizationId],
        references: [exports.organizations.id],
    }),
    workflows: many(exports.workflows),
    invitations: many(exports.invitations),
}));
// Workflows
exports.workflows = (0, pg_core_1.pgTable)('workflows', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    workspaceId: (0, pg_core_1.text)('workspace_id').notNull().references(() => exports.workspaces.id, { onDelete: 'cascade' }),
    definition: (0, pg_core_1.jsonb)('definition').notNull(),
    active: (0, pg_core_1.boolean)('active').default(true).notNull(),
    settings: (0, pg_core_1.jsonb)('settings'),
    tags: (0, pg_core_1.jsonb)('tags').$type().default([]), // Array of tag strings
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.workflowsRelations = (0, drizzle_orm_1.relations)(exports.workflows, ({ one, many }) => ({
    workspace: one(exports.workspaces, {
        fields: [exports.workflows.workspaceId],
        references: [exports.workspaces.id],
    }),
    versions: many(exports.workflowVersions),
    executions: many(exports.workflowExecutions),
    webhooks: many(exports.webhookRegistry),
}));
// Webhook Registry
exports.webhookRegistry = (0, pg_core_1.pgTable)('webhook_registry', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    workflowId: (0, pg_core_1.text)('workflow_id').notNull().references(() => exports.workflows.id, { onDelete: 'cascade' }),
    path: (0, pg_core_1.text)('path').notNull(),
    method: (0, pg_core_1.text)('method').default('POST').notNull(),
    nodeId: (0, pg_core_1.text)('node_id').notNull(), // ID of the webhook trigger node
    active: (0, pg_core_1.boolean)('active').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.webhookRegistryRelations = (0, drizzle_orm_1.relations)(exports.webhookRegistry, ({ one }) => ({
    workflow: one(exports.workflows, {
        fields: [exports.webhookRegistry.workflowId],
        references: [exports.workflows.id],
    }),
}));
// Workflow Versions
exports.workflowVersions = (0, pg_core_1.pgTable)('workflow_versions', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    workflowId: (0, pg_core_1.text)('workflow_id').notNull().references(() => exports.workflows.id, { onDelete: 'cascade' }),
    version: (0, pg_core_1.integer)('version').notNull(),
    definition: (0, pg_core_1.jsonb)('definition').notNull(),
    createdBy: (0, pg_core_1.text)('created_by'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.workflowVersionsRelations = (0, drizzle_orm_1.relations)(exports.workflowVersions, ({ one }) => ({
    workflow: one(exports.workflows, {
        fields: [exports.workflowVersions.workflowId],
        references: [exports.workflows.id],
    }),
}));
// Workflow Executions
exports.workflowExecutions = (0, pg_core_1.pgTable)('workflow_executions', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    workflowId: (0, pg_core_1.text)('workflow_id').notNull().references(() => exports.workflows.id, { onDelete: 'cascade' }),
    status: (0, exports.executionStatusEnum)('status').notNull(),
    startedAt: (0, pg_core_1.timestamp)('started_at').defaultNow().notNull(),
    finishedAt: (0, pg_core_1.timestamp)('finished_at'),
    input: (0, pg_core_1.jsonb)('input'),
    output: (0, pg_core_1.jsonb)('output'),
    error: (0, pg_core_1.text)('error'),
    metadata: (0, pg_core_1.jsonb)('metadata'),
});
exports.workflowExecutionsRelations = (0, drizzle_orm_1.relations)(exports.workflowExecutions, ({ one, many }) => ({
    workflow: one(exports.workflows, {
        fields: [exports.workflowExecutions.workflowId],
        references: [exports.workflows.id],
    }),
    logs: many(exports.executionLogs),
}));
// Execution Logs
exports.executionLogs = (0, pg_core_1.pgTable)('execution_logs', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    executionId: (0, pg_core_1.text)('execution_id').notNull().references(() => exports.workflowExecutions.id, { onDelete: 'cascade' }),
    nodeId: (0, pg_core_1.text)('node_id').notNull(),
    level: (0, exports.logLevelEnum)('level').notNull(),
    message: (0, pg_core_1.text)('message').notNull(),
    data: (0, pg_core_1.jsonb)('data'),
    timestamp: (0, pg_core_1.timestamp)('timestamp').defaultNow().notNull(),
});
exports.executionLogsRelations = (0, drizzle_orm_1.relations)(exports.executionLogs, ({ one }) => ({
    execution: one(exports.workflowExecutions, {
        fields: [exports.executionLogs.executionId],
        references: [exports.workflowExecutions.id],
    }),
}));
// Plugins
exports.plugins = (0, pg_core_1.pgTable)('plugins', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    version: (0, pg_core_1.text)('version').notNull(),
    author: (0, pg_core_1.text)('author'),
    category: (0, pg_core_1.text)('category'),
    config: (0, pg_core_1.jsonb)('config'),
    code: (0, pg_core_1.text)('code'),
    public: (0, pg_core_1.boolean)('public').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
// API Keys
exports.apiKeys = (0, pg_core_1.pgTable)('api_keys', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    name: (0, pg_core_1.text)('name').notNull(),
    key: (0, pg_core_1.text)('key').notNull().unique(),
    userId: (0, pg_core_1.text)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }),
    organizationId: (0, pg_core_1.text)('organization_id').references(() => exports.organizations.id, { onDelete: 'cascade' }),
    permissions: (0, pg_core_1.jsonb)('permissions'),
    lastUsedAt: (0, pg_core_1.timestamp)('last_used_at'),
    expiresAt: (0, pg_core_1.timestamp)('expires_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.apiKeysRelations = (0, drizzle_orm_1.relations)(exports.apiKeys, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.apiKeys.userId],
        references: [exports.users.id],
    }),
    organization: one(exports.organizations, {
        fields: [exports.apiKeys.organizationId],
        references: [exports.organizations.id],
    }),
}));
// Audit Logs
exports.auditLogs = (0, pg_core_1.pgTable)('audit_logs', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    userId: (0, pg_core_1.text)('user_id').references(() => exports.users.id, { onDelete: 'set null' }),
    organizationId: (0, pg_core_1.text)('organization_id'),
    action: (0, pg_core_1.text)('action').notNull(),
    resourceType: (0, pg_core_1.text)('resource_type').notNull(),
    resourceId: (0, pg_core_1.text)('resource_id'),
    details: (0, pg_core_1.jsonb)('details'),
    ipAddress: (0, pg_core_1.text)('ip_address'),
    userAgent: (0, pg_core_1.text)('user_agent'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.auditLogsRelations = (0, drizzle_orm_1.relations)(exports.auditLogs, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.auditLogs.userId],
        references: [exports.users.id],
    }),
}));
// Alert Types
exports.alertTypeEnum = (0, pg_core_1.pgEnum)('alert_type', ['failure', 'performance', 'usage', 'custom']);
exports.alertStatusEnum = (0, pg_core_1.pgEnum)('alert_status', ['active', 'inactive', 'triggered']);
exports.notificationChannelEnum = (0, pg_core_1.pgEnum)('notification_channel', ['email', 'slack', 'webhook']);
// Alerts
exports.alerts = (0, pg_core_1.pgTable)('alerts', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    organizationId: (0, pg_core_1.text)('organization_id').notNull().references(() => exports.organizations.id, { onDelete: 'cascade' }),
    workflowId: (0, pg_core_1.text)('workflow_id').references(() => exports.workflows.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    type: (0, exports.alertTypeEnum)('type').notNull(),
    status: (0, exports.alertStatusEnum)('status').default('active').notNull(),
    conditions: (0, pg_core_1.jsonb)('conditions').notNull(), // Alert conditions (e.g., { threshold: 100, operator: '>' })
    notificationChannels: (0, pg_core_1.jsonb)('notification_channels').notNull(), // Array of channels with config
    enabled: (0, pg_core_1.boolean)('enabled').default(true).notNull(),
    cooldownMinutes: (0, pg_core_1.integer)('cooldown_minutes').default(60), // Prevent spam
    lastTriggeredAt: (0, pg_core_1.timestamp)('last_triggered_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.alertsRelations = (0, drizzle_orm_1.relations)(exports.alerts, ({ one }) => ({
    organization: one(exports.organizations, {
        fields: [exports.alerts.organizationId],
        references: [exports.organizations.id],
    }),
    workflow: one(exports.workflows, {
        fields: [exports.alerts.workflowId],
        references: [exports.workflows.id],
    }),
}));
// Alert History
exports.alertHistory = (0, pg_core_1.pgTable)('alert_history', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    alertId: (0, pg_core_1.text)('alert_id').notNull().references(() => exports.alerts.id, { onDelete: 'cascade' }),
    executionId: (0, pg_core_1.text)('execution_id').references(() => exports.workflowExecutions.id, { onDelete: 'set null' }),
    triggeredAt: (0, pg_core_1.timestamp)('triggered_at').defaultNow().notNull(),
    message: (0, pg_core_1.text)('message').notNull(),
    details: (0, pg_core_1.jsonb)('details'),
    notificationSent: (0, pg_core_1.boolean)('notification_sent').default(false),
    notificationChannels: (0, pg_core_1.jsonb)('notification_channels'), // Which channels were notified
});
exports.alertHistoryRelations = (0, drizzle_orm_1.relations)(exports.alertHistory, ({ one }) => ({
    alert: one(exports.alerts, {
        fields: [exports.alertHistory.alertId],
        references: [exports.alerts.id],
    }),
    execution: one(exports.workflowExecutions, {
        fields: [exports.alertHistory.executionId],
        references: [exports.workflowExecutions.id],
    }),
}));
// Roles (Custom roles for organizations)
exports.roles = (0, pg_core_1.pgTable)('roles', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    organizationId: (0, pg_core_1.text)('organization_id').notNull().references(() => exports.organizations.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    isSystem: (0, pg_core_1.boolean)('is_system').default(false).notNull(), // System roles cannot be deleted
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.rolesRelations = (0, drizzle_orm_1.relations)(exports.roles, ({ one, many }) => ({
    organization: one(exports.organizations, {
        fields: [exports.roles.organizationId],
        references: [exports.organizations.id],
    }),
    permissions: many(exports.rolePermissions),
    organizationMembers: many(exports.organizationMembers),
}));
// Permissions (Permission definitions)
exports.permissions = (0, pg_core_1.pgTable)('permissions', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    resourceType: (0, pg_core_1.text)('resource_type').notNull(), // 'workflow', 'workspace', 'organization', 'alert', etc.
    action: (0, pg_core_1.text)('action').notNull(), // 'read', 'write', 'execute', 'delete', 'admin'
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
});
exports.permissionsRelations = (0, drizzle_orm_1.relations)(exports.permissions, ({ many }) => ({
    rolePermissions: many(exports.rolePermissions),
}));
// Role Permissions (Many-to-many relationship)
exports.rolePermissions = (0, pg_core_1.pgTable)('role_permissions', {
    roleId: (0, pg_core_1.text)('role_id').notNull().references(() => exports.roles.id, { onDelete: 'cascade' }),
    permissionId: (0, pg_core_1.text)('permission_id').notNull().references(() => exports.permissions.id, { onDelete: 'cascade' }),
}, (table) => ({
    pk: { primaryKey: { columns: [table.roleId, table.permissionId] } },
}));
exports.rolePermissionsRelations = (0, drizzle_orm_1.relations)(exports.rolePermissions, ({ one }) => ({
    role: one(exports.roles, {
        fields: [exports.rolePermissions.roleId],
        references: [exports.roles.id],
    }),
    permission: one(exports.permissions, {
        fields: [exports.rolePermissions.permissionId],
        references: [exports.permissions.id],
    }),
}));
// Teams
exports.teams = (0, pg_core_1.pgTable)('teams', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    organizationId: (0, pg_core_1.text)('organization_id').notNull().references(() => exports.organizations.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.text)('name').notNull(),
    description: (0, pg_core_1.text)('description'),
    settings: (0, pg_core_1.jsonb)('settings'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.teamsRelations = (0, drizzle_orm_1.relations)(exports.teams, ({ one, many }) => ({
    organization: one(exports.organizations, {
        fields: [exports.teams.organizationId],
        references: [exports.organizations.id],
    }),
    members: many(exports.teamMembers),
}));
// Team Members
exports.teamMembers = (0, pg_core_1.pgTable)('team_members', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    teamId: (0, pg_core_1.text)('team_id').notNull().references(() => exports.teams.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.text)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    roleId: (0, pg_core_1.text)('role_id').references(() => exports.roles.id, { onDelete: 'set null' }),
    joinedAt: (0, pg_core_1.timestamp)('joined_at').defaultNow().notNull(),
});
exports.teamMembersRelations = (0, drizzle_orm_1.relations)(exports.teamMembers, ({ one }) => ({
    team: one(exports.teams, {
        fields: [exports.teamMembers.teamId],
        references: [exports.teams.id],
    }),
    user: one(exports.users, {
        fields: [exports.teamMembers.userId],
        references: [exports.users.id],
    }),
    role: one(exports.roles, {
        fields: [exports.teamMembers.roleId],
        references: [exports.roles.id],
    }),
}));
// Invitations
exports.invitations = (0, pg_core_1.pgTable)('invitations', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    organizationId: (0, pg_core_1.text)('organization_id').notNull().references(() => exports.organizations.id, { onDelete: 'cascade' }),
    workspaceId: (0, pg_core_1.text)('workspace_id').references(() => exports.workspaces.id, { onDelete: 'cascade' }),
    teamId: (0, pg_core_1.text)('team_id').references(() => exports.teams.id, { onDelete: 'cascade' }),
    email: (0, pg_core_1.text)('email').notNull(),
    roleId: (0, pg_core_1.text)('role_id').references(() => exports.roles.id, { onDelete: 'set null' }),
    invitedBy: (0, pg_core_1.text)('invited_by').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    token: (0, pg_core_1.text)('token').notNull().unique(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at').notNull(),
    acceptedAt: (0, pg_core_1.timestamp)('accepted_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.invitationsRelations = (0, drizzle_orm_1.relations)(exports.invitations, ({ one }) => ({
    organization: one(exports.organizations, {
        fields: [exports.invitations.organizationId],
        references: [exports.organizations.id],
    }),
    workspace: one(exports.workspaces, {
        fields: [exports.invitations.workspaceId],
        references: [exports.workspaces.id],
    }),
    team: one(exports.teams, {
        fields: [exports.invitations.teamId],
        references: [exports.teams.id],
    }),
    role: one(exports.roles, {
        fields: [exports.invitations.roleId],
        references: [exports.roles.id],
    }),
    inviter: one(exports.users, {
        fields: [exports.invitations.invitedBy],
        references: [exports.users.id],
    }),
}));
// Email Trigger Configurations
exports.emailTriggers = (0, pg_core_1.pgTable)('email_triggers', {
    id: (0, pg_core_1.text)('id').primaryKey().$defaultFn(() => (0, cuid2_1.createId)()),
    userId: (0, pg_core_1.text)('user_id').notNull().references(() => exports.users.id, { onDelete: 'cascade' }),
    organizationId: (0, pg_core_1.text)('organization_id').references(() => exports.organizations.id, { onDelete: 'cascade' }),
    workflowId: (0, pg_core_1.text)('workflow_id').notNull().references(() => exports.workflows.id, { onDelete: 'cascade' }),
    nodeId: (0, pg_core_1.text)('node_id').notNull(), // The trigger node ID in the workflow
    provider: (0, pg_core_1.text)('provider').notNull(), // 'gmail', 'outlook', 'imap'
    email: (0, pg_core_1.text)('email').notNull(), // Email address being monitored
    credentials: (0, pg_core_1.jsonb)('credentials').notNull(), // Encrypted OAuth tokens or IMAP credentials
    folder: (0, pg_core_1.text)('folder').default('INBOX'), // Email folder to monitor (for IMAP)
    lastCheckedAt: (0, pg_core_1.timestamp)('last_checked_at'),
    lastMessageId: (0, pg_core_1.text)('last_message_id'), // Last processed message ID
    active: (0, pg_core_1.boolean)('active').default(true).notNull(),
    pollInterval: (0, pg_core_1.integer)('poll_interval').default(60).notNull(), // Poll interval in seconds
    filters: (0, pg_core_1.jsonb)('filters'), // Email filters (from, subject, etc.)
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.emailTriggersRelations = (0, drizzle_orm_1.relations)(exports.emailTriggers, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.emailTriggers.userId],
        references: [exports.users.id],
    }),
    organization: one(exports.organizations, {
        fields: [exports.emailTriggers.organizationId],
        references: [exports.organizations.id],
    }),
    workflow: one(exports.workflows, {
        fields: [exports.emailTriggers.workflowId],
        references: [exports.workflows.id],
    }),
}));
// All exports are already above
//# sourceMappingURL=schema.js.map