// Vercel Cron Job - Cleanup Retention Policies
// Runs daily at 2 AM

import { db } from '../../backend/src/config/database';
import { organizations } from '../../backend/drizzle/schema';
import { observabilityService } from '../../backend/src/services/observabilityService';

export default async function handler(req: any, res: any) {
  // Verify this is a cron request from Vercel
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Cron] Starting retention policy cleanup...');
    
    // Get all organizations
    const orgs = await db.select().from(organizations);

    let cleaned = 0;
    for (const org of orgs) {
      try {
        await observabilityService.cleanupOldEventsForOrganization(org.id, org.plan);
        cleaned++;
      } catch (err: any) {
        console.error(`[Cron] Failed to cleanup events for org ${org.id}:`, err);
      }
    }

    res.json({ 
      success: true, 
      organizationsProcessed: cleaned,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Cron] Error in retention cleanup:', error);
    res.status(500).json({ error: error.message });
  }
}

