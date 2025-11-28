// Vercel Cron Job - Cleanup Audit Logs
// Runs daily at 3 AM

import { db } from '../../backend/src/config/database';
import { auditLogs } from '../../backend/drizzle/schema';
import { lt } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  // Verify this is a cron request from Vercel
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Cron] Starting audit log cleanup...');
    
    // Delete audit logs older than 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const result = await db
      .delete(auditLogs)
      .where(lt(auditLogs.timestamp, cutoffDate));

    res.json({ 
      success: true, 
      deleted: result.rowCount || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron] Error in audit log cleanup:', error);
    res.status(500).json({ error: error.message });
  }
}

