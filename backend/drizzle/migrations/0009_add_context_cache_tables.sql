-- Context Cache Tables
-- For storing agent context and execution state with rollback support

-- Context cache table
CREATE TABLE IF NOT EXISTS context_cache (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  context JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Context snapshots table (for rollback)
CREATE TABLE IF NOT EXISTS context_snapshots (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  context JSONB NOT NULL,
  checkpoint INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_context_cache_agent_execution ON context_cache(agent_id, execution_id);
CREATE INDEX IF NOT EXISTS idx_context_cache_execution ON context_cache(execution_id);
CREATE INDEX IF NOT EXISTS idx_context_cache_workflow ON context_cache(workflow_id);
CREATE INDEX IF NOT EXISTS idx_context_cache_updated ON context_cache(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_snapshots_execution_checkpoint ON context_snapshots(execution_id, checkpoint);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_execution ON context_snapshots(execution_id);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_created ON context_snapshots(created_at DESC);

-- GIN index for JSONB context search
CREATE INDEX IF NOT EXISTS idx_context_cache_context_gin ON context_cache USING GIN (context);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_context_gin ON context_snapshots USING GIN (context);

