import { db } from '../src/config/database';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigrations() {
  try {
    console.log('Applying missing migrations...\n');
    
    // Check if tags column exists
    const tagsCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workflows' AND column_name = 'tags';
    `);
    
    if (tagsCheck.length === 0) {
      console.log('Adding tags column to workflows table...');
      await db.execute(sql`ALTER TABLE "workflows" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;`);
      console.log('✅ Tags column added\n');
    } else {
      console.log('✅ Tags column already exists\n');
    }
    
    // Check if preferences column exists
    const preferencesCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'preferences';
    `);
    
    if (preferencesCheck.length === 0) {
      console.log('Adding preferences column to users table...');
      await db.execute(sql`ALTER TABLE "users" ADD COLUMN "preferences" jsonb;`);
      console.log('✅ Preferences column added\n');
    } else {
      console.log('✅ Preferences column already exists\n');
    }
    
    console.log('✅ All migrations applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying migrations:', error);
    process.exit(1);
  }
}

applyMigrations();

