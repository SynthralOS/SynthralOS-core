// Script to apply performance indexes for vector store tables
import { db } from '../src/config/database';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function applyIndexes() {
  try {
    console.log('Applying performance indexes for vector store tables...\n');

    // Define indexes to create
    const indexes = [
      {
        name: 'idx_vector_documents_org_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_vector_documents_org_id ON vector_documents(organization_id);`
      },
      {
        name: 'idx_vector_indexes_org_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_vector_indexes_org_id ON vector_indexes(organization_id);`
      },
      {
        name: 'idx_vector_documents_index_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_vector_documents_index_id ON vector_documents(index_id);`
      },
      {
        name: 'idx_vector_documents_org_index',
        sql: `CREATE INDEX IF NOT EXISTS idx_vector_documents_org_index ON vector_documents(organization_id, index_id);`
      },
      {
        name: 'idx_vector_indexes_org_name',
        sql: `CREATE INDEX IF NOT EXISTS idx_vector_indexes_org_name ON vector_indexes(organization_id, name);`
      }
    ];

    console.log(`Found ${indexes.length} indexes to create...\n`);

    for (let i = 0; i < indexes.length; i++) {
      const index = indexes[i];
      try {
        console.log(`Creating index ${i + 1}/${indexes.length}: ${index.name}...`);
        await db.execute(sql.raw(index.sql));
        console.log(`  ✅ Index ${index.name} created successfully`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          console.log(`  ⚠️  Index ${index.name} already exists (skipped)`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ All indexes applied successfully!\n');

    // Verify indexes were created
    console.log('Verifying indexes...');
    const indexesCheck = await db.execute(sql`
      SELECT 
        indexname,
        tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('vector_indexes', 'vector_documents')
        AND indexname LIKE 'idx_vector_%'
      ORDER BY tablename, indexname;
    `);

    const foundIndexes = indexesCheck as any[];
    console.log(`\nFound ${foundIndexes.length} vector store indexes:\n`);
    foundIndexes.forEach((idx: any) => {
      console.log(`  ✅ ${idx.indexname} on ${idx.tablename}`);
    });

    console.log('\n🎉 Index creation complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error applying indexes:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyIndexes();

