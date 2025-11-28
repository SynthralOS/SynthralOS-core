// Polling endpoint for execution status (replaces WebSocket)
// Frontend can poll this endpoint to get real-time execution updates

import { db } from '../../backend/src/config/database';
import { executions } from '../../backend/drizzle/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { executionId } = req.query;

  if (!executionId) {
    return res.status(400).json({ error: 'executionId is required' });
  }

  try {
    // Get execution status
    const [execution] = await db
      .select()
      .from(executions)
      .where(eq(executions.id, executionId))
      .limit(1);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Return execution status
    res.json({
      id: execution.id,
      status: execution.status,
      progress: execution.progress || 0,
      currentNode: execution.currentNode,
      result: execution.result,
      error: execution.error,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      updatedAt: execution.updatedAt,
    });
  } catch (error: any) {
    console.error('Error fetching execution status:', error);
    res.status(500).json({ error: error.message });
  }
}

