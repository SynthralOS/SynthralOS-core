/**
 * Script to apply the workflow_templates migration
 */

import { db } from '../src/config/database';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  try {
    console.log('Applying workflow_templates migration...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../drizzle/migrations/0007_unknown_may_parker.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by statement-breakpoint and execute each statement
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 100) + '...');
        await db.execute(sql.raw(statement));
      }
    }

    console.log('\n✅ Migration applied successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error applying migration:', error.message);
    if (error.message.includes('already exists')) {
      console.log('⚠️  Table may already exist. This is okay.');
      process.exit(0);
    }
    console.error(error);
    process.exit(1);
  }
}

applyMigration();

