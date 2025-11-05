const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('fs');
const { join } = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('=== Database Migration ===\n');

    const migrationPath = join(
      __dirname,
      '../prisma/migrations/20251105_fix_timezone_and_duplicate_index/migration.sql'
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

    // Verify timezone changes
    const timezoneCheck = await prisma.$queryRaw`
      SELECT
        column_name,
        data_type
      FROM information_schema.columns
      WHERE table_schema = 'aedpics'
        AND (
          (table_name = 'gps_issues' AND column_name IN ('resolved_at', 'created_at', 'updated_at'))
          OR (table_name = 'gps_analysis_logs' AND column_name = 'created_at')
        )
    `;

    const allTimestamptz = timezoneCheck.every(col => col.data_type === 'timestamp with time zone');
    if (allTimestamptz) {
      console.log('✓ All timestamp columns converted to timestamptz');
    } else {
      console.warn('⚠ Some columns may not be timestamptz');
      console.log(timezoneCheck);
    }

    // Verify index removal
    const indexCheck = await prisma.$queryRaw`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'aedpics'
        AND tablename = 'aed_data'
        AND indexname = 'idx_aed_data_serial'
    `;

    if (indexCheck.length === 0) {
      console.log('✓ Duplicate index removed successfully');
    } else {
      console.warn('⚠ Duplicate index may still exist');
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
