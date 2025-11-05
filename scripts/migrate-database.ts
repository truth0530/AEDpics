import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('=== Database Migration ===\n');

    const migrationPath = join(
      __dirname,
      '../prisma/migrations/20251105_add_organization_change_requests/migration.sql'
    );

    console.log('Reading migration SQL...');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Executing migration...\n');

    // Split SQL by statements (simple approach - assumes statements end with ;)
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 80)}...`);
      await prisma.$executeRawUnsafe(statement);
    }

    console.log('\n✓ Migration completed successfully');

    // Verify table creation
    const result = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'aedpics'
        AND tablename = 'organization_change_requests'
    `;

    if (result.length > 0) {
      console.log('✓ Table organization_change_requests verified');
    } else {
      console.error('⚠ Table verification failed');
      process.exit(1);
    }

    console.log('\n=== Migration Complete ===');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
