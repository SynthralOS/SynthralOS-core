import { db } from '../src/config/database';
import { sql } from 'drizzle-orm';

async function verifyIndexes() {
  try {
    console.log('Verifying audit_logs indexes...\n');
    
    const result = await db.execute(sql`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'audit_logs'
      ORDER BY indexname;
    `);
    
    console.log(`Found ${result.length} indexes on audit_logs table:\n`);
    result.forEach((row: any) => {
      console.log(`✅ ${row.indexname}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error verifying indexes:', error);
    process.exit(1);
  }
}

verifyIndexes();

