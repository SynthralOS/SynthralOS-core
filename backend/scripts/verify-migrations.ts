import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

async function verifyMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set in .env file.');
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    // Check if drizzle migrations table exists
    let migrationsTableExists = false;
    try {
      await sql`SELECT 1 FROM drizzle.__drizzle_migrations LIMIT 1`;
      migrationsTableExists = true;
    } catch (error: any) {
      if (error.message.includes('does not exist')) {
        console.log('⚠️  Drizzle migrations table does not exist. Migrations may not have been run.');
        migrationsTableExists = false;
      } else {
        throw error;
      }
    }

    // Get applied migrations
    let appliedMigrations: Array<{ hash: string; created_at: number }> = [];
    if (migrationsTableExists) {
      appliedMigrations = await sql`
        SELECT hash, created_at 
        FROM drizzle.__drizzle_migrations 
        ORDER BY created_at
      `;
    }

    // Get all migration files
    const migrationsDir = join(__dirname, '../drizzle/migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log('\n📊 Migration Status Report\n');
    console.log('=' .repeat(60));
    console.log(`Total migration files: ${migrationFiles.length}`);
    console.log(`Applied migrations: ${appliedMigrations.length}`);
    console.log('=' .repeat(60) + '\n');

    // Check each migration file
    const missingMigrations: string[] = [];
    const appliedHashes = new Set(appliedMigrations.map(m => m.hash));

    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Extract hash from filename (format: 0000_name.sql)
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        console.log(`⚠️  ${file} - Invalid filename format`);
        continue;
      }

      const [, index, name] = match;
      const hash = name; // Drizzle uses the name part as hash

      // Check if this migration has been applied
      const isApplied = appliedHashes.has(hash) || 
                       appliedMigrations.some(m => m.hash.includes(name.split('_')[0]));

      if (isApplied) {
        console.log(`✅ ${file} - Applied`);
      } else {
        console.log(`❌ ${file} - NOT APPLIED`);
        missingMigrations.push(file);
      }
    }

    console.log('\n' + '=' .repeat(60));

    if (missingMigrations.length === 0) {
      console.log('\n✅ All migrations have been applied!');
    } else {
      console.log(`\n⚠️  ${missingMigrations.length} migration(s) need to be applied:`);
      missingMigrations.forEach(file => console.log(`   - ${file}`));
      console.log('\nTo apply migrations, run:');
      console.log('   npm run db:push');
      console.log('   OR');
      console.log('   npx drizzle-kit push');
    }

    // Check for duplicate migration numbers
    const migrationNumbers = migrationFiles.map(f => {
      const match = f.match(/^(\d+)_/);
      return match ? parseInt(match[1], 10) : null;
    }).filter(Boolean) as number[];

    const duplicates = migrationNumbers.filter((num, idx) => migrationNumbers.indexOf(num) !== idx);
    if (duplicates.length > 0) {
      console.log('\n⚠️  WARNING: Duplicate migration numbers found:');
      duplicates.forEach(num => {
        const files = migrationFiles.filter(f => f.startsWith(`${num.toString().padStart(4, '0')}_`));
        console.log(`   Migration ${num}: ${files.join(', ')}`);
      });
    }

    console.log('\n');
  } catch (error) {
    console.error('❌ Error verifying migrations:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifyMigrations();

