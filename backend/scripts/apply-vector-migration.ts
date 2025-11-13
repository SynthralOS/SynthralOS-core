// Script to apply vector store migration to Supabase
import { db } from '../src/config/database';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
  try {
    console.log('Applying vector store migration to Supabase...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../drizzle/migrations/0006_stale_bromley.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by statement breakpoints and execute each statement
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          await db.execute(sql.raw(statement));
          console.log(`  ✅ Statement ${i + 1} executed successfully`);
        } catch (error: any) {
          // Ignore "already exists" errors (IF NOT EXISTS handles this)
          if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
            console.log(`  ⚠️  Statement ${i + 1} skipped (already exists)`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log('\n✅ Migration applied successfully!\n');

    // Verify tables were created
    console.log('Verifying tables...');
    const indexesCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vector_indexes'
      ) as exists;
    `);

    const documentsCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vector_documents'
      ) as exists;
    `);

    const indexesExists = (indexesCheck as any)[0]?.exists || false;
    const documentsExists = (documentsCheck as any)[0]?.exists || false;

    console.log(`  vector_indexes: ${indexesExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log(`  vector_documents: ${documentsExists ? '✅ EXISTS' : '❌ NOT FOUND'}\n`);

    if (indexesExists && documentsExists) {
      console.log('🎉 Migration complete! Vector store tables are ready to use.');
      process.exit(0);
    } else {
      console.log('⚠️  Migration may have failed. Please check the errors above.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error applying migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyMigration();

