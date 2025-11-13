// Script to check if vector store tables exist in the database
import { db } from '../src/config/database';
import { sql } from 'drizzle-orm';

async function checkVectorTables() {
  try {
    console.log('Checking for vector store tables in Supabase...\n');

    // Check if vector_indexes table exists
    const indexesResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vector_indexes'
      ) as exists;
    `);

    // Check if vector_documents table exists
    const documentsResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'vector_documents'
      ) as exists;
    `);

    const indexesExists = (indexesResult as any)[0]?.exists || false;
    const documentsExists = (documentsResult as any)[0]?.exists || false;

    console.log('Table Status:');
    console.log(`  vector_indexes: ${indexesExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log(`  vector_documents: ${documentsExists ? '✅ EXISTS' : '❌ NOT FOUND'}\n`);

    if (indexesExists && documentsExists) {
      console.log('✅ Both tables exist! Migration already applied.');
      process.exit(0);
    } else {
      console.log('⚠️  Tables missing. Migration needs to be applied.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Error checking tables:', error.message);
    console.error('\nThis might mean:');
    console.error('  1. Database connection issue');
    console.error('  2. Tables need to be created');
    process.exit(1);
  }
}

checkVectorTables();

