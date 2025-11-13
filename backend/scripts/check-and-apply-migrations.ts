import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

async function checkAndApplyMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set in .env file.');
    console.error('Please set DATABASE_URL in your .env file.');
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    console.log('\n🔍 Checking migration status...\n');

    // Ensure migrations table exists
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    // Get applied migrations
    const appliedMigrations = await sql`
      SELECT hash, created_at 
      FROM drizzle.__drizzle_migrations 
      ORDER BY created_at
    `;

    // Get all migration files
    const migrationsDir = join(__dirname, '../drizzle/migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${migrationFiles.length} migration files`);
    console.log(`✅ ${appliedMigrations.length} migrations already applied\n`);

    // Check each migration file
    const missingMigrations: Array<{ file: string; content: string; index: number }> = [];
    const appliedHashes = new Set(appliedMigrations.map(m => m.hash));
    const appliedFiles = new Set(appliedMigrations.map(m => {
      // Try to match hash to filename
      const migration = migrationFiles.find(f => f.includes(m.hash));
      return migration || m.hash;
    }));

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
      // Check both by hash and by filename
      const isApplied = appliedHashes.has(hash) || 
                       appliedFiles.has(file) ||
                       appliedMigrations.some(m => file.includes(m.hash) || m.hash.includes(name.split('_')[0]));

      if (isApplied) {
        console.log(`✅ ${file} - Already applied`);
      } else {
        console.log(`❌ ${file} - NOT APPLIED`);
        missingMigrations.push({ file, content, index });
      }
    }

    console.log('\n' + '='.repeat(60));

    if (missingMigrations.length === 0) {
      console.log('\n✅ All migrations have been applied to the database!');
      console.log('   No action needed.\n');
      return;
    }

    // Sort by index
    missingMigrations.sort((a, b) => a.index - b.index);

    console.log(`\n⚠️  ${missingMigrations.length} migration(s) need to be applied:\n`);
    missingMigrations.forEach(({ file }) => console.log(`   - ${file}`));

    // Ask to apply (in non-interactive mode, just apply)
    console.log('\n📝 Applying missing migrations...\n');

    for (const { file, content, index } of missingMigrations) {
      try {
        console.log(`Applying ${file}...`);

        // Split by statement-breakpoint and execute each statement
        const statements = content
          .split('--> statement-breakpoint')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            await sql.unsafe(statement);
          }
        }

        // Record migration as applied
        const hash = file.match(/^\d+_(.+)\.sql$/)?.[1] || file;
        await sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${hash}, ${Date.now()})
          ON CONFLICT DO NOTHING
        `;

        console.log(`✅ ${file} - Applied successfully\n`);
      } catch (error: any) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('relation') && error.message.includes('already exists')) {
          console.log(`⚠️  ${file} - Some objects may already exist (this is okay)`);
          
          // Still record as applied
          const hash = file.match(/^\d+_(.+)\.sql$/)?.[1] || file;
          await sql`
            INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
            VALUES (${hash}, ${Date.now()})
            ON CONFLICT DO NOTHING
          `;
          console.log(`✅ ${file} - Marked as applied\n`);
        } else {
          console.error(`❌ ${file} - Error:`, error.message);
          throw error;
        }
      }
    }

    console.log('='.repeat(60));
    console.log('\n✅ All migrations have been applied!\n');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('connection')) {
      console.error('\n💡 Make sure:');
      console.error('   1. DATABASE_URL is correct in .env file');
      console.error('   2. Database is accessible');
      console.error('   3. Network connection is working\n');
    }
    process.exit(1);
  } finally {
    await sql.end();
  }
}

checkAndApplyMigrations();

