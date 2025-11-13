/**
 * Script to check and apply all database migrations to Supabase
 * 
 * This script:
 * 1. Checks which migrations have been applied
 * 2. Applies any missing migrations
 * 3. Records them in the migrations table
 */

import * as dotenv from 'dotenv';
// Try multiple .env file locations
dotenv.config({ path: '.env' });
dotenv.config({ path: '../.env' });

import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

async function applyAllMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set in .env file.');
    console.error('Please set DATABASE_URL in your .env file.');
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    console.log('\n🔍 Checking database migration status...\n');
    console.log('='.repeat(60));

    // Ensure migrations table exists
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL UNIQUE,
        created_at bigint
      )
    `;

    // Get applied migrations
    const appliedMigrations = await sql`
      SELECT hash, created_at 
      FROM drizzle.__drizzle_migrations 
      ORDER BY created_at
    `;

    // Get all migration files (sorted by number)
    const migrationsDir = join(__dirname, '../drizzle/migrations');
    const allFiles = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    
    // Sort migrations by their number prefix
    const migrationFiles = allFiles.sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)_/)?.[1] || '999', 10);
      const numB = parseInt(b.match(/^(\d+)_/)?.[1] || '999', 10);
      return numA - numB;
    });

    console.log(`📁 Found ${migrationFiles.length} migration files`);
    console.log(`✅ ${appliedMigrations.length} migrations already applied\n`);

    // Check each migration file
    const missingMigrations: Array<{ file: string; content: string; index: number; hash: string }> = [];
    const appliedHashes = new Set(appliedMigrations.map(m => m.hash));

    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Extract hash from filename (format: 0000_name.sql)
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        console.log(`⚠️  ${file} - Invalid filename format, skipping`);
        continue;
      }

      const [, indexStr, name] = match;
      const index = parseInt(indexStr, 10);
      const hash = name;

      // Check if this migration has been applied
      const isApplied = appliedHashes.has(hash);

      if (isApplied) {
        console.log(`✅ ${file.padEnd(50)} - Already applied`);
      } else {
        console.log(`❌ ${file.padEnd(50)} - NOT APPLIED`);
        missingMigrations.push({ file, content, index, hash });
      }
    }

    console.log('\n' + '='.repeat(60));

    if (missingMigrations.length === 0) {
      console.log('\n✅ All migrations have been applied to the database!');
      console.log('   No action needed.\n');
      return;
    }

    // Sort by index to apply in order
    missingMigrations.sort((a, b) => a.index - b.index);

    console.log(`\n⚠️  ${missingMigrations.length} migration(s) need to be applied:\n`);
    missingMigrations.forEach(({ file }) => console.log(`   - ${file}`));

    console.log('\n📝 Applying missing migrations...\n');
    console.log('='.repeat(60) + '\n');

    for (const { file, content, index, hash } of missingMigrations) {
      try {
        console.log(`Applying ${file}...`);

        // Split by statement-breakpoint and execute each statement
        const statements = content
          .split('--> statement-breakpoint')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            // Show first 80 chars of statement
            const preview = statement.substring(0, 80).replace(/\n/g, ' ');
            console.log(`   Executing: ${preview}...`);
            await sql.unsafe(statement);
          }
        }

        // Record migration as applied
        await sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${hash}, ${Date.now()})
          ON CONFLICT (hash) DO NOTHING
        `;

        console.log(`✅ ${file} - Applied successfully\n`);
      } catch (error: any) {
        // Handle common "already exists" errors gracefully
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            (error.message.includes('relation') && error.message.includes('already exists')) ||
            error.message.includes('constraint') && error.message.includes('already exists')) {
          console.log(`⚠️  ${file} - Some objects may already exist (this is okay)`);
          
          // Still record as applied
          await sql`
            INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
            VALUES (${hash}, ${Date.now()})
            ON CONFLICT (hash) DO NOTHING
          `;
          console.log(`✅ ${file} - Marked as applied\n`);
        } else {
          console.error(`❌ ${file} - Error:`, error.message);
          console.error('\nFull error:', error);
          throw error;
        }
      }
    }

    console.log('='.repeat(60));
    console.log('\n✅ All migrations have been applied successfully!\n');
    
    // Final verification
    const finalCount = await sql`SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations`;
    console.log(`📊 Total migrations in database: ${finalCount[0].count}`);
    console.log(`📁 Total migration files: ${migrationFiles.length}\n`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Connection Error - Make sure:');
      console.error('   1. DATABASE_URL is correct in .env file');
      console.error('   2. Database is accessible');
      console.error('   3. Network connection is working');
      console.error('   4. Supabase database is running\n');
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

applyAllMigrations();

