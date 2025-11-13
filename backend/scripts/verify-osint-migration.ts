/**
 * Script to verify OSINT migration was applied correctly
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '../.env' });

import postgres from 'postgres';

async function verifyMigration() {
  let databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  if (databaseUrl.includes('db.qgfutvkhhsjbjthkammv.supabase.co')) {
    const passwordMatch = databaseUrl.match(/postgresql:\/\/postgres:([^@]+)@/);
    const password = passwordMatch ? passwordMatch[1] : 'SynthralOS';
    databaseUrl = `postgresql://postgres.qgfutvkhhsjbjthkammv:${password}@aws-1-us-west-1.pooler.supabase.com:5432/postgres`;
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log('\n🔍 Verifying OSINT Migration...\n');
    console.log('='.repeat(60));

    // Check tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('osint_monitors', 'osint_results')
      ORDER BY table_name
    `;

    console.log('📊 Tables:');
    if (tables.length === 2) {
      console.log('   ✅ osint_monitors');
      console.log('   ✅ osint_results');
    } else {
      console.log('   ❌ Missing tables!');
      tables.forEach(t => console.log(`   - ${t.table_name}`));
    }

    // Check enums
    const enums = await sql`
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('osint_source', 'osint_monitor_status')
      ORDER BY typname
    `;

    console.log('\n📊 Enums:');
    if (enums.length === 2) {
      console.log('   ✅ osint_source');
      console.log('   ✅ osint_monitor_status');
    } else {
      console.log('   ❌ Missing enums!');
      enums.forEach(e => console.log(`   - ${e.typname}`));
    }

    // Check indexes
    const indexes = await sql`
      SELECT indexname, tablename
      FROM pg_indexes 
      WHERE tablename IN ('osint_monitors', 'osint_results')
      AND schemaname = 'public'
      ORDER BY tablename, indexname
    `;

    console.log('\n📊 Indexes:');
    if (indexes.length > 0) {
      indexes.forEach(idx => console.log(`   ✅ ${idx.indexname} (${idx.tablename})`));
    } else {
      console.log('   ⚠️  No indexes found');
    }

    // Check foreign keys
    const fks = await sql`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name IN ('osint_monitors', 'osint_results')
      ORDER BY tc.table_name
    `;

    console.log('\n📊 Foreign Keys:');
    if (fks.length > 0) {
      fks.forEach(fk => {
        console.log(`   ✅ ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    } else {
      console.log('   ⚠️  No foreign keys found');
    }

    // Check columns
    const monitorColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'osint_monitors'
      ORDER BY ordinal_position
    `;

    console.log('\n📊 osint_monitors columns:');
    monitorColumns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    console.log('\n' + '='.repeat(60));
    
    if (tables.length === 2 && enums.length === 2) {
      console.log('\n✅ Migration verification successful!');
      console.log('   All tables, enums, and constraints are in place.\n');
    } else {
      console.log('\n⚠️  Migration verification incomplete');
      console.log('   Some components may be missing.\n');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifyMigration();


