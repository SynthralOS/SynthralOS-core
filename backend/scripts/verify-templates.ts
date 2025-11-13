/**
 * Script to verify templates were migrated successfully
 */

import { db } from '../src/config/database';
import { workflowTemplates } from '../drizzle/schema';
import { sql } from 'drizzle-orm';

async function verifyTemplates() {
  try {
    console.log('Verifying templates in database...\n');

    // Count templates
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(workflowTemplates);

    console.log(`Total templates: ${count[0]?.count || 0}\n`);

    // List all templates
    const templates = await db
      .select({
        id: workflowTemplates.id,
        name: workflowTemplates.name,
        category: workflowTemplates.category,
        isPublic: workflowTemplates.isPublic,
        usageCount: workflowTemplates.usageCount,
      })
      .from(workflowTemplates);

    console.log('Templates:');
    templates.forEach((t) => {
      console.log(`  - ${t.name} (${t.category}) - Public: ${t.isPublic}, Usage: ${t.usageCount}`);
    });

    console.log('\n✅ Verification complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error verifying templates:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyTemplates();

