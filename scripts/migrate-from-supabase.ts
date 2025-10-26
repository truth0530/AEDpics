/**
 * Supabase to NCP PostgreSQL Data Migration Script
 *
 * This script migrates data from Supabase to NCP PostgreSQL database
 * using Prisma for the target database and Supabase client for the source.
 *
 * Usage: npx tsx scripts/migrate-from-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

// Initialize Supabase client (source)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Prisma client (target - NCP PostgreSQL)
const prisma = new PrismaClient();

// Migration statistics
interface MigrationStats {
  table: string;
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

const stats: MigrationStats[] = [];

/**
 * Utility function to add stats
 */
function addStats(table: string, total: number, success: number, failed: number, skipped: number = 0) {
  stats.push({ table, total, success, failed, skipped });
}

/**
 * Print migration summary
 */
function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(80));

  let totalRecords = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  stats.forEach(stat => {
    totalRecords += stat.total;
    totalSuccess += stat.success;
    totalFailed += stat.failed;
    totalSkipped += stat.skipped;

    console.log(`\n${stat.table}:`);
    console.log(`  Total: ${stat.total}`);
    console.log(`  Success: ${stat.success}`);
    console.log(`  Failed: ${stat.failed}`);
    if (stat.skipped > 0) {
      console.log(`  Skipped: ${stat.skipped}`);
    }
  });

  console.log('\n' + '-'.repeat(80));
  console.log('OVERALL:');
  console.log(`  Total Records: ${totalRecords}`);
  console.log(`  Successfully Migrated: ${totalSuccess}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  Skipped: ${totalSkipped}`);
  console.log('='.repeat(80) + '\n');
}

/**
 * Migrate organizations table
 */
async function migrateOrganizations() {
  console.log('\n[1/8] Migrating organizations...');

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching organizations:', error);
    addStats('organizations', 0, 0, 1);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No organizations to migrate');
    addStats('organizations', 0, 0, 0);
    return;
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const org of data) {
    try {
      // Check if organization already exists
      const existing = await prisma.organizations.findUnique({
        where: { id: org.id }
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.organizations.create({
        data: {
          id: org.id,
          name: org.name,
          type: org.type,
          parent_id: org.parent_id,
          region_code: org.region_code,
          address: org.address,
          contact: org.contact,
          latitude: org.latitude,
          longitude: org.longitude,
          created_at: org.created_at,
          updated_at: org.updated_at,
        }
      });
      success++;
    } catch (e: any) {
      console.error(`Failed to migrate organization ${org.id}:`, e.message);
      failed++;
    }
  }

  addStats('organizations', data.length, success, failed, skipped);
  console.log(`Migrated ${success}/${data.length} organizations (${skipped} skipped)`);
}

/**
 * Map old Supabase role to new NCP role
 */
function mapRole(oldRole: string): any {
  const roleMap: Record<string, string> = {
    'regional_emergency_center_admin': 'regional_admin',
    'emergency_center_admin': 'emergency_center_admin',
    'temporary_inspector': 'local_admin',
    'local_admin': 'local_admin',
    'master': 'master',
    'ministry_admin': 'ministry_admin',
    'pending_approval': 'pending_approval',
    'email_verified': 'email_verified',
  };

  return roleMap[oldRole] || 'pending_approval';
}

/**
 * Migrate user_profiles table
 */
async function migrateUserProfiles() {
  console.log('\n[2/8] Migrating user_profiles...');

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: true});

  if (error) {
    console.error('Error fetching user_profiles:', error);
    addStats('user_profiles', 0, 0, 1);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No user profiles to migrate');
    addStats('user_profiles', 0, 0, 0);
    return;
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const profile of data) {
    try {
      // Check if user profile already exists
      const existing = await prisma.user_profiles.findUnique({
        where: { id: profile.id }
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.user_profiles.create({
        data: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone,
          organization_id: profile.organization_id,
          role: mapRole(profile.role),
          is_active: profile.is_active,
          approved_by: profile.approved_by,
          approved_at: profile.approved_at,
          region: profile.region,
          organization_name: profile.organization_name,
          remarks: profile.remarks,
          region_code: profile.region_code,
          district: profile.district,
          department: profile.department,
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        }
      });
      success++;
    } catch (e: any) {
      console.error(`Failed to migrate user profile ${profile.id}:`, e.message);
      failed++;
    }
  }

  addStats('user_profiles', data.length, success, failed, skipped);
  console.log(`Migrated ${success}/${data.length} user profiles (${skipped} skipped)`);
}

/**
 * Migrate aed_data table
 *
 * NOTE: The NCP PostgreSQL schema for aed_data has been completely redesigned
 * to match the e-gen system structure. The old Supabase schema is incompatible.
 * This migration is SKIPPED - data will need to be imported from e-gen directly.
 */
async function migrateAedData() {
  console.log('\n[3/8] Skipping aed_data migration...');
  console.log('REASON: Schema incompatibility - new schema matches e-gen structure');
  console.log('ACTION REQUIRED: Import AED data directly from e-gen CSV/API');

  addStats('aed_data', 0, 0, 0, 0);
}

/**
 * Migrate inspections table
 *
 * NOTE: The NCP PostgreSQL schema for inspections has been significantly enhanced
 * with many new fields for detailed inspection tracking. The old Supabase schema
 * is incompatible. This migration is SKIPPED - inspection data will be created
 * fresh with the new system.
 */
async function migrateInspections() {
  console.log('\n[4/8] Skipping inspections migration...');
  console.log('REASON: Schema incompatibility - new schema has enhanced fields');
  console.log('ACTION REQUIRED: Fresh inspections will be created with new system');

  addStats('inspections', 0, 0, 0, 0);
}

/**
 * Migrate audit_logs table
 */
async function migrateAuditLogs() {
  console.log('\n[5/8] Migrating audit_logs...');

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching audit_logs:', error);
    addStats('audit_logs', 0, 0, 1);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No audit logs to migrate');
    addStats('audit_logs', 0, 0, 0);
    return;
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const log of data) {
    try {
      const existing = await prisma.audit_logs.findUnique({
        where: { id: log.id }
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.audit_logs.create({
        data: {
          id: log.id,
          user_id: log.user_id,
          action: log.action,
          entity_type: log.table_name,
          entity_id: log.record_id,
          metadata: {
            old_values: log.old_values,
            new_values: log.new_values,
          },
          ip_address: log.ip_address,
          user_agent: log.user_agent,
          created_at: log.created_at,
        }
      });
      success++;
    } catch (e: any) {
      console.error(`Failed to migrate audit log ${log.id}:`, e.message);
      failed++;
    }
  }

  addStats('audit_logs', data.length, success, failed, skipped);
  console.log(`Migrated ${success}/${data.length} audit logs (${skipped} skipped)`);
}

/**
 * Migrate login_history table
 */
async function migrateLoginHistory() {
  console.log('\n[6/8] Migrating login_history...');

  const { data, error } = await supabase
    .from('login_history')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching login_history:', error);
    addStats('login_history', 0, 0, 1);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No login history to migrate');
    addStats('login_history', 0, 0, 0);
    return;
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const login of data) {
    try {
      const existing = await prisma.login_history.findUnique({
        where: { id: login.id }
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.login_history.create({
        data: {
          id: login.id,
          user_id: login.user_id,
          login_time: login.login_at,
          ip_address: login.ip_address,
          user_agent: login.user_agent,
          success: login.success ?? true,
          created_at: login.created_at || login.login_at,
        }
      });
      success++;
    } catch (e: any) {
      console.error(`Failed to migrate login history ${login.id}:`, e.message);
      failed++;
    }
  }

  addStats('login_history', data.length, success, failed, skipped);
  console.log(`Migrated ${success}/${data.length} login history records (${skipped} skipped)`);
}

/**
 * Migrate notifications table
 */
async function migrateNotifications() {
  console.log('\n[7/8] Migrating notifications...');

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching notifications:', error);
    addStats('notifications', 0, 0, 1);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No notifications to migrate');
    addStats('notifications', 0, 0, 0);
    return;
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const notification of data) {
    try {
      const existing = await prisma.notifications.findUnique({
        where: { id: notification.id }
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.notifications.create({
        data: {
          id: notification.id,
          recipient_id: notification.user_id,
          sender_id: notification.sender_id || null,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          is_read: notification.read ?? false,
          data: {
            related_table: notification.related_table,
            related_id: notification.related_id,
            read_at: notification.read_at,
          },
          created_at: notification.created_at,
          expires_at: notification.expires_at || null,
        }
      });
      success++;
    } catch (e: any) {
      console.error(`Failed to migrate notification ${notification.id}:`, e.message);
      failed++;
    }
  }

  addStats('notifications', data.length, success, failed, skipped);
  console.log(`Migrated ${success}/${data.length} notifications (${skipped} skipped)`);
}

/**
 * Migrate inspection_schedule_entries table
 */
async function migrateInspectionScheduleEntries() {
  console.log('\n[8/8] Migrating inspection_schedule_entries...');

  const { data, error } = await supabase
    .from('inspection_schedule_entries')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching inspection_schedule_entries:', error);
    addStats('inspection_schedule_entries', 0, 0, 1);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No inspection schedule entries to migrate');
    addStats('inspection_schedule_entries', 0, 0, 0);
    return;
  }

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const entry of data) {
    try {
      const existing = await prisma.inspection_schedule_entries.findUnique({
        where: { id: entry.id }
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Skip if missing required fields
      if (!entry.device_equipment_serial || !entry.created_by) {
        console.warn(`Skipping schedule entry ${entry.id}: missing required fields`);
        failed++;
        continue;
      }

      await prisma.inspection_schedule_entries.create({
        data: {
          id: entry.id,
          device_equipment_serial: entry.device_equipment_serial || entry.aed_id,
          scheduled_for: entry.scheduled_date || entry.scheduled_for,
          assignee_identifier: entry.assigned_inspector_id || entry.assignee_identifier || 'unknown',
          priority: entry.priority || 'normal',
          status: entry.status || 'scheduled',
          notes: entry.notes,
          created_by: entry.created_by,
          created_at: entry.created_at,
          updated_at: entry.updated_at,
        }
      });
      success++;
    } catch (e: any) {
      console.error(`Failed to migrate schedule entry ${entry.id}:`, e.message);
      failed++;
    }
  }

  addStats('inspection_schedule_entries', data.length, success, failed, skipped);
  console.log(`Migrated ${success}/${data.length} inspection schedule entries (${skipped} skipped)`);
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('='.repeat(80));
  console.log('SUPABASE TO NCP POSTGRESQL DATA MIGRATION');
  console.log('='.repeat(80));
  console.log(`\nSource: ${supabaseUrl}`);
  console.log(`Target: NCP PostgreSQL (via Prisma)`);
  console.log(`\nStarting migration at: ${new Date().toISOString()}\n`);

  try {
    // Migrate tables in order (respecting foreign key dependencies)
    await migrateOrganizations();
    await migrateUserProfiles();
    await migrateAedData();
    await migrateInspections();
    await migrateAuditLogs();
    await migrateLoginHistory();
    await migrateNotifications();
    await migrateInspectionScheduleEntries();

    // Print summary
    printSummary();

    console.log(`\nMigration completed at: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('\nMigration failed with error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\nMigration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration script failed:', error);
    process.exit(1);
  });
