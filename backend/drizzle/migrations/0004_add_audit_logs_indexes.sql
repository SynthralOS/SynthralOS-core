-- Add indexes for audit_logs table to improve query performance
-- These indexes support common filtering patterns in the audit logs API

-- Index for organization-scoped queries (most common filter)
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);

-- Index for date range filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Index for user activity queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Index for resource type filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);

-- Index for action filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Composite index for common query pattern: organization + date range
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);

-- Composite index for resource-specific queries: organization + resource type + date
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_resource_created ON audit_logs(organization_id, resource_type, created_at DESC);

-- Composite index for user activity queries: organization + user + date
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_user_created ON audit_logs(organization_id, user_id, created_at DESC);

