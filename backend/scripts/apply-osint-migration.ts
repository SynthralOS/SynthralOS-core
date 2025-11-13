/**
 * Script to apply OSINT migration directly to Supabase
 * This script applies the 0009_rich_manta.sql migration
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '../.env' });

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyOSINTMigration() {
  // Get DATABASE_URL from environment
  let databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set in .env file.');
    console.error('Please set DATABASE_URL in your .env file.');
    process.exit(1);
  }

  // Convert direct connection to shared session pooler if needed
  if (databaseUrl.includes('db.qgfutvkhhsjbjthkammv.supabase.co')) {
    // Extract password from original URL
    const passwordMatch = databaseUrl.match(/postgresql:\/\/postgres:([^@]+)@/);
    const password = passwordMatch ? passwordMatch[1] : 'SynthralOS';
    databaseUrl = `postgresql://postgres.qgfutvkhhsjbjthkammv:${password}@aws-1-us-west-1.pooler.supabase.com:5432/postgres`;
    console.log('📡 Using Supabase connection pooler...');
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  try {
    console.log('\n🔍 Applying OSINT migration to Supabase...\n');
    console.log('='.repeat(60));

    // Read the migration file
    const migrationFile = join(__dirname, '../drizzle/migrations/0009_rich_manta.sql');
    const migrationContent = readFileSync(migrationFile, 'utf-8');

    console.log('📄 Migration file: 0009_rich_manta.sql\n');

    // Split by statement-breakpoint and execute each statement
    const statements = migrationContent
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        // Show preview of statement
        const preview = statement.substring(0, 100).replace(/\n/g, ' ').trim();
        console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);
        
        try {
          await sql.unsafe(statement);
          console.log(`   ✅ Success\n`);
        } catch (error: any) {
          // Handle "already exists" errors gracefully (idempotent)
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate') ||
              (error.message.includes('relation') && error.message.includes('already exists')) ||
              (error.message.includes('constraint') && error.message.includes('already exists')) ||
              error.message.includes('duplicate_object')) {
            console.log(`   ⚠️  Already exists (this is okay)\n`);
          } else {
            console.error(`   ❌ Error: ${error.message}\n`);
            throw error;
          }
        }
      }
    }

    console.log('='.repeat(60));
    console.log('\n✅ Migration applied successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...\n');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('osint_monitors', 'osint_results')
      ORDER BY table_name
    `;

    if (tables.length === 2) {
      console.log('✅ Tables created successfully:');
      tables.forEach(t => console.log(`   - ${t.table_name}`));
    } else {
      console.log('⚠️  Expected 2 tables, found:', tables.length);
      tables.forEach(t => console.log(`   - ${t.table_name}`));
    }

    // Verify enums
    const enums = await sql`
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('osint_source', 'osint_monitor_status')
      ORDER BY typname
    `;

    if (enums.length === 2) {
      console.log('\n✅ Enums created successfully:');
      enums.forEach(e => console.log(`   - ${e.typname}`));
    } else {
      console.log('\n⚠️  Expected 2 enums, found:', enums.length);
      enums.forEach(e => console.log(`   - ${e.typname}`));
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ OSINT migration completed successfully!\n');
    console.log('📊 Next steps:');
    console.log('   1. Restart the backend server');
    console.log('   2. Test creating an OSINT monitor via the UI');
    console.log('   3. Verify data collection works\n');

  } catch (error: any) {
    console.error('\n❌ Error applying migration:', error.message);
    if (error.message.includes('connection') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.error('\n💡 Connection Error - Make sure:');
      console.error('   1. DATABASE_URL is correct in .env file');
      console.error('   2. Supabase database is accessible');
      console.error('   3. Network connection is working');
      console.error('   4. You can connect to Supabase from this machine\n');
      console.error('   Alternative: Apply migration via Supabase Dashboard:');
      console.error('   1. Go to Supabase Dashboard > SQL Editor');
      console.error('   2. Copy contents of backend/drizzle/migrations/0009_rich_manta.sql');
      console.error('   3. Paste and run in SQL Editor\n');
    } else if (error.message.includes('authentication')) {
      console.error('\n💡 Authentication Error - Make sure:');
      console.error('   1. DATABASE_URL has correct credentials');
      console.error('   2. Database user has necessary permissions\n');
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyOSINTMigration();


