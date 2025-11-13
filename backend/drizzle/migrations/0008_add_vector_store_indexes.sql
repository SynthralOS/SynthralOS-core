-- Add performance indexes for vector store tables
-- These indexes improve query performance for organization-based queries and index lookups

-- Index for faster organization-based queries on vector_documents
CREATE INDEX IF NOT EXISTS idx_vector_documents_org_id 
ON vector_documents(organization_id);

-- Index for faster organization-based queries on vector_indexes
CREATE INDEX IF NOT EXISTS idx_vector_indexes_org_id 
ON vector_indexes(organization_id);

-- Index for faster index_id lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_vector_documents_index_id 
ON vector_documents(index_id);

-- Composite index for common query pattern: organization + index
CREATE INDEX IF NOT EXISTS idx_vector_documents_org_index 
ON vector_documents(organization_id, index_id);

-- Index for faster index lookups by organization and name
CREATE INDEX IF NOT EXISTS idx_vector_indexes_org_name 
ON vector_indexes(organization_id, name);

