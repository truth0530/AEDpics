const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('fs');
const { join } = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('=== Database Migration ===\n');

    const migrationPath = join(
      __dirname,
      '../prisma/migrations/20251105_add_organization_change_requests/migration.sql'
    );

    console.log(`Reading migration SQL from: ${migrationPath}`);
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Executing migration...\n');

    // Remove comments first
    const sqlWithoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    // Smart split that handles DO $$ ... END $$; blocks
    const statements = [];
    let currentStatement = '';
    let inDoBlock = false;

    for (const char of sqlWithoutComments) {
      currentStatement += char;

      // Check if we're entering or exiting a DO block
      if (currentStatement.trim().match(/DO\s+\$\$$/i)) {
        inDoBlock = true;
      } else if (inDoBlock && currentStatement.trim().match(/END\s+\$\$;$/i)) {
        statements.push(currentStatement.trim());
        currentStatement = '';
        inDoBlock = false;
        continue;
      }

      // Split by ; only when not in DO block
      if (!inDoBlock && char === ';') {
        const stmt = currentStatement.trim();
        if (stmt.length > 0) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }

    console.log(`Total statements found: ${statements.length}\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
      console.log(`[${i+1}/${statements.length}] Executing: ${preview}...`);
      await prisma.$executeRawUnsafe(statement);
    }

    console.log('\n✓ Migration completed successfully');

    // Verify table creation
    const result = await prisma.$queryRaw`
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
