import { db } from '../config/database';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

// Direct postgres client for raw SQL queries
const getPostgresClient = () => {
  let connectionString = process.env.DATABASE_URL!;
  if (connectionString.includes('db.qgfutvkhhsjbjthkammv.supabase.co')) {
    connectionString = 'postgresql://postgres.qgfutvkhhsjbjthkammv:SynthralOS@aws-1-us-west-1.pooler.supabase.com:5432/postgres';
  }
  return postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
  });
};

/**
 * Context Cache Service
 * 
 * Database-backed storage for agent context and execution state
 * Supports rollback and fast path finding (Graphiti-like)
 */

export interface ContextEntry {
  id: string;
  agentId: string;
  workflowId: string;
  executionId: string;
  context: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContextSnapshot {
  snapshotId: string;
  agentId: string;
  workflowId: string;
  executionId: string;
  context: Record<string, unknown>;
  checkpoint: number;
  createdAt: Date;
}

export interface PathNode {
  nodeId: string;
  agentId: string;
  context: Record<string, unknown>;
  cost: number; // Estimated cost or distance
  timestamp: Date;
}

export interface PathResult {
  path: PathNode[];
  totalCost: number;
  found: boolean;
}

/**
 * Context Cache Service
 */
export class ContextCacheService {
  private contextCache: Map<string, ContextEntry> = new Map();
  private snapshots: Map<string, ContextSnapshot[]> = new Map(); // executionId -> snapshots

  /**
   * Store context for an agent execution
   */
  async storeContext(
    agentId: string,
    workflowId: string,
    executionId: string,
    context: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const contextId = createId();
    const now = new Date();

    const entry: ContextEntry = {
      id: contextId,
      agentId,
      workflowId,
      executionId,
      context,
      metadata,
      createdAt: now,
      updatedAt: now,
    };

    // Store in memory cache
    this.contextCache.set(contextId, entry);

    // Store in database (using JSONB)
    try {
      const client = getPostgresClient();
      await client`
        INSERT INTO context_cache (
          id, agent_id, workflow_id, execution_id, context, metadata, created_at, updated_at
        ) VALUES (
          ${contextId},
          ${agentId},
          ${workflowId},
          ${executionId},
          ${JSON.stringify(context)}::jsonb,
          ${metadata ? JSON.stringify(metadata) : null}::jsonb,
          ${now},
          ${now}
        )
        ON CONFLICT (id) DO UPDATE SET
          context = EXCLUDED.context,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
      `;
      await client.end();
    } catch (error) {
      console.error('Error storing context in database:', error);
      // Continue with in-memory cache only
    }

    return contextId;
  }

  /**
   * Retrieve context for an agent execution
   */
  async getContext(
    agentId: string,
    executionId: string
  ): Promise<ContextEntry | null> {
    // Try memory cache first
    for (const entry of this.contextCache.values()) {
      if (entry.agentId === agentId && entry.executionId === executionId) {
        return entry;
      }
    }

    // Try database
    try {
      const client = getPostgresClient();
      const result = await client`
        SELECT id, agent_id, workflow_id, execution_id, context, metadata, created_at, updated_at
        FROM context_cache
        WHERE agent_id = ${agentId} AND execution_id = ${executionId}
        ORDER BY updated_at DESC
        LIMIT 1
      `;
      await client.end();

      if (result.length > 0) {
        const row = result[0];
        const entry: ContextEntry = {
          id: row.id as string,
          agentId: row.agent_id as string,
          workflowId: row.workflow_id as string,
          executionId: row.execution_id as string,
          context: row.context as Record<string, unknown>,
          metadata: row.metadata as Record<string, unknown>,
          createdAt: new Date(row.created_at as Date),
          updatedAt: new Date(row.updated_at as Date),
        };

        // Cache in memory
        this.contextCache.set(entry.id, entry);
        return entry;
      }
    } catch (error) {
      console.error('Error retrieving context from database:', error);
    }

    return null;
  }

  /**
   * Create a snapshot (checkpoint) for rollback
   */
  async createSnapshot(
    agentId: string,
    workflowId: string,
    executionId: string,
    context: Record<string, unknown>,
    checkpoint: number
  ): Promise<string> {
    const snapshotId = createId();
    const now = new Date();

    const snapshot: ContextSnapshot = {
      snapshotId,
      agentId,
      workflowId,
      executionId,
      context: JSON.parse(JSON.stringify(context)), // Deep copy
      checkpoint,
      createdAt: now,
    };

    // Store in memory
    const snapshots = this.snapshots.get(executionId) || [];
    snapshots.push(snapshot);
    this.snapshots.set(executionId, snapshots);

    // Store in database
    try {
      const client = getPostgresClient();
      await client`
        INSERT INTO context_snapshots (
          id, agent_id, workflow_id, execution_id, context, checkpoint, created_at
        ) VALUES (
          ${snapshotId},
          ${agentId},
          ${workflowId},
          ${executionId},
          ${JSON.stringify(context)}::jsonb,
          ${checkpoint},
          ${now}
        )
      `;
      await client.end();
    } catch (error) {
      console.error('Error storing snapshot in database:', error);
    }

    return snapshotId;
  }

  /**
   * Rollback to a snapshot
   */
  async rollbackToSnapshot(
    executionId: string,
    checkpoint: number
  ): Promise<ContextSnapshot | null> {
    // Find snapshot in memory
    const snapshots = this.snapshots.get(executionId) || [];
    const snapshot = snapshots.find(s => s.checkpoint === checkpoint);

    if (snapshot) {
      return snapshot;
    }

    // Find in database
    try {
      const client = getPostgresClient();
      const result = await client`
        SELECT id, agent_id, workflow_id, execution_id, context, checkpoint, created_at
        FROM context_snapshots
        WHERE execution_id = ${executionId} AND checkpoint = ${checkpoint}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      await client.end();

      if (result.length > 0) {
        const row = result[0];
        const snapshot: ContextSnapshot = {
          snapshotId: row.id as string,
          agentId: row.agent_id as string,
          workflowId: row.workflow_id as string,
          executionId: row.execution_id as string,
          context: row.context as Record<string, unknown>,
          checkpoint: row.checkpoint as number,
          createdAt: new Date(row.created_at as Date),
        };

        return snapshot;
      }
    } catch (error) {
      console.error('Error retrieving snapshot from database:', error);
    }

    return null;
  }

  /**
   * Fast path finding (Graphiti-like)
   * Finds the shortest path to a goal state
   */
  async findPath(
    agentId: string,
    startContext: Record<string, unknown>,
    goalPredicate: (context: Record<string, unknown>) => boolean,
    maxDepth: number = 10
  ): Promise<PathResult> {
    const visited = new Set<string>();
    const queue: Array<{ node: PathNode; path: PathNode[] }> = [
      {
        node: {
          nodeId: createId(),
          agentId,
          context: startContext,
          cost: 0,
          timestamp: new Date(),
        },
        path: [],
      },
    ];

    while (queue.length > 0 && queue[0].path.length < maxDepth) {
      const { node, path } = queue.shift()!;
      const contextKey = JSON.stringify(node.context);

      if (visited.has(contextKey)) {
        continue;
      }

      visited.add(contextKey);

      // Check if goal is reached
      if (goalPredicate(node.context)) {
        return {
          path: [...path, node],
          totalCost: node.cost,
          found: true,
        };
      }

      // Find similar contexts from cache (neighbors)
      const neighbors = await this.findSimilarContexts(node.context, agentId, 5);

      for (const neighbor of neighbors) {
        const neighborKey = JSON.stringify(neighbor.context);
        if (!visited.has(neighborKey)) {
          const cost = node.cost + this.calculateCost(node.context, neighbor.context);
          queue.push({
            node: {
              ...neighbor,
              cost,
            },
            path: [...path, node],
          });
        }
      }

      // Sort queue by cost (Dijkstra-like)
      queue.sort((a, b) => a.node.cost - b.node.cost);
    }

    return {
      path: [],
      totalCost: Infinity,
      found: false,
    };
  }

  /**
   * Find similar contexts (neighbors for path finding)
   */
  private async findSimilarContexts(
    context: Record<string, unknown>,
    agentId: string,
    limit: number = 5
  ): Promise<PathNode[]> {
    const neighbors: PathNode[] = [];

    // Search in memory cache
    for (const entry of this.contextCache.values()) {
      if (entry.agentId === agentId) {
        const similarity = this.calculateSimilarity(context, entry.context);
        if (similarity > 0.5) {
          neighbors.push({
            nodeId: entry.id,
            agentId: entry.agentId,
            context: entry.context,
            cost: 1 - similarity, // Lower cost for higher similarity
            timestamp: entry.updatedAt,
          });
        }
      }
    }

    // Sort by similarity (cost)
    neighbors.sort((a, b) => a.cost - b.cost);
    return neighbors.slice(0, limit);
  }

  /**
   * Calculate similarity between two contexts
   */
  private calculateSimilarity(
    context1: Record<string, unknown>,
    context2: Record<string, unknown>
  ): number {
    const keys1 = new Set(Object.keys(context1));
    const keys2 = new Set(Object.keys(context2));
    const intersection = new Set([...keys1].filter(k => keys2.has(k)));
    const union = new Set([...keys1, ...keys2]);

    if (union.size === 0) {
      return 1.0;
    }

    // Jaccard similarity
    const jaccard = intersection.size / union.size;

    // Value similarity for common keys
    let valueSimilarity = 0;
    for (const key of intersection) {
      if (JSON.stringify(context1[key]) === JSON.stringify(context2[key])) {
        valueSimilarity += 1;
      }
    }

    const valueSim = intersection.size > 0 ? valueSimilarity / intersection.size : 0;

    // Combined similarity
    return (jaccard * 0.5) + (valueSim * 0.5);
  }

  /**
   * Calculate cost between two contexts
   */
  private calculateCost(
    context1: Record<string, unknown>,
    context2: Record<string, unknown>
  ): number {
    const similarity = this.calculateSimilarity(context1, context2);
    return 1 - similarity; // Cost is inverse of similarity
  }

  /**
   * Delete context for an execution
   */
  async deleteContext(executionId: string): Promise<void> {
    // Delete from memory
    for (const [id, entry] of this.contextCache.entries()) {
      if (entry.executionId === executionId) {
        this.contextCache.delete(id);
      }
    }

    // Delete from database
    try {
      const client = getPostgresClient();
      await client`
        DELETE FROM context_cache
        WHERE execution_id = ${executionId}
      `;
      await client.end();
    } catch (error) {
      console.error('Error deleting context from database:', error);
    }
  }

  /**
   * Get all snapshots for an execution
   */
  getSnapshots(executionId: string): ContextSnapshot[] {
    return this.snapshots.get(executionId) || [];
  }
}

export const contextCacheService = new ContextCacheService();

