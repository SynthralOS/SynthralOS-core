import { db } from '../src/config/database';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  try {
    console.log('Applying audit logs indexes migration...');
    
    const migrationPath = path.join(__dirname, '../drizzle/migrations/0004_add_audit_logs_indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolons and execute each statement
    // Handle multi-line statements properly
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
        console.log(`Executing: ${preview}...`);
        try {
          await db.execute(sql.raw(statement + ';'));
        } catch (error: any) {
          // Ignore "already exists" errors for IF NOT EXISTS
          if (!error.message?.includes('already exists')) {
            throw error;
          }
          console.log(`  (Index already exists, skipping)`);
        }
      }
    }
    
    console.log('✅ Migration applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  }
}

applyMigration();

