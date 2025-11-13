/**
 * Migration script to move hardcoded templates to database
 * Run this once after creating the workflow_templates table
 */

import { db } from '../src/config/database';
import { workflowTemplates } from '../drizzle/schema';
import { defaultTemplates } from '../src/routes/templates';

async function migrateTemplates() {
  try {
    console.log('Starting template migration...\n');

    // Check if templates already exist
    const existing = await db.select().from(workflowTemplates).limit(1);
    if (existing.length > 0) {
      console.log('⚠️  Templates already exist in database. Skipping migration.');
      console.log('   If you want to re-migrate, delete existing templates first.');
      process.exit(0);
    }

    console.log(`Found ${defaultTemplates.length} templates to migrate...\n`);

    // Insert all default templates as public templates
    for (const template of defaultTemplates) {
      await db.insert(workflowTemplates).values({
        id: template.id, // Use the same ID from hardcoded templates
        name: template.name,
        description: template.description,
        category: template.category,
        definition: template.definition as any,
        organizationId: null, // Public templates
        createdBy: null, // System templates
        isPublic: true,
        usageCount: 0,
        tags: [],
      });
      console.log(`✅ Migrated: ${template.name}`);
    }

    console.log(`\n✅ Successfully migrated ${defaultTemplates.length} templates to database!`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error migrating templates:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrateTemplates();

