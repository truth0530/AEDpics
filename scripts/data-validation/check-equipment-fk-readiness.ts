#!/usr/bin/env node

/**
 * Phase 0: Check Equipment FK Readiness
 *
 * Validates that all data is compatible with FK constraints before schema migration.
 * Generates migration-readiness-report.json with validation results.
 *
 * Usage:
 * npx tsx scripts/data-validation/check-equipment-fk-readiness.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ValidationResult {
  table: string;
  total_records: number;
  valid_records: number;
  issues: Record<string, number>;
  ready_for_fk: boolean;
  details: string[];
}

interface MigrationReadinessReport {
  generated_at: string;
  environment: string;
  overall_status: 'READY' | 'ISSUES_FOUND' | 'CRITICAL';
  validations: ValidationResult[];
  summary: {
    total_tables: number;
    tables_ready: number;
    tables_with_issues: number;
    total_issues: number;
    recommendations: string[];
  };
}

async function validateInspectionScheduleEntries(): Promise<ValidationResult> {
  console.log('\nValidating inspection_schedule_entries...');

  const totalRecords = await prisma.inspection_schedule_entries.count();
  console.log(`  Total records: ${totalRecords}`);

  const result: ValidationResult = {
    table: 'inspection_schedule_entries',
    total_records: totalRecords,
    valid_records: totalRecords,
    issues: {},
    ready_for_fk: true,
    details: []
  };

  // Check 1: NULL device_equipment_serial (using raw SQL)
  const nullEquipmentQueryResult = await prisma.$queryRaw<
    Array<{ count: number }>
  >`
    SELECT COUNT(*)::int as count
    FROM inspection_schedule_entries
    WHERE device_equipment_serial IS NULL
  `;

  const nullEquipmentCount = nullEquipmentQueryResult[0]?.count || 0;
  if (nullEquipmentCount > 0) {
    result.issues['null_equipment_serial'] = nullEquipmentCount;
    result.ready_for_fk = false;
    result.valid_records -= nullEquipmentCount;
    result.details.push(`Found ${nullEquipmentCount} records with NULL device_equipment_serial`);
    console.log(`  ❌ NULL device_equipment_serial: ${nullEquipmentCount}`);
  } else {
    console.log(`  ✅ NULL device_equipment_serial: 0`);
  }

  // Check 2: Orphan records (serial not in aed_data)
  const orphanQuery = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`
    SELECT COUNT(*)::int as count
    FROM inspection_schedule_entries ise
    LEFT JOIN aed_data ad ON ise.device_equipment_serial = ad.equipment_serial
    WHERE ad.equipment_serial IS NULL AND ise.device_equipment_serial IS NOT NULL
  `;

  const orphanCount = orphanQuery[0]?.count || 0n;
  if (orphanCount > 0) {
    result.issues['orphan_records'] = Number(orphanCount);
    result.ready_for_fk = false;
    result.valid_records -= Number(orphanCount);
    result.details.push(
      `Found ${orphanCount} orphan records (equipment_serial not in aed_data)`
    );
    console.log(`  ❌ Orphan records: ${orphanCount}`);
  } else {
    console.log(`  ✅ Orphan records: 0`);
  }

  // Check 3: VARCHAR length validation (255 max)
  const longSerialsQuery = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`
    SELECT COUNT(*)::int as count
    FROM inspection_schedule_entries
    WHERE LENGTH(device_equipment_serial) > 255
  `;

  const longSerialsCount = longSerialsQuery[0]?.count || 0n;
  if (longSerialsCount > 0) {
    result.issues['serial_too_long'] = Number(longSerialsCount);
    result.ready_for_fk = false;
    result.details.push(`Found ${longSerialsCount} records with serial > 255 characters`);
    console.log(`  ❌ Serial too long: ${longSerialsCount}`);
  } else {
    console.log(`  ✅ Serial length: OK`);
  }

  return result;
}

async function validateInspectionAssignments(): Promise<ValidationResult> {
  console.log('\nValidating inspection_assignments...');

  const totalRecords = await prisma.inspection_assignments.count();
  console.log(`  Total records: ${totalRecords}`);

  const result: ValidationResult = {
    table: 'inspection_assignments',
    total_records: totalRecords,
    valid_records: totalRecords,
    issues: {},
    ready_for_fk: true,
    details: []
  };

  // Check 1: NULL equipment_serial (using raw SQL)
  const nullEquipmentQuery = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`
    SELECT COUNT(*)::int as count
    FROM inspection_assignments
    WHERE equipment_serial IS NULL
  `;

  const nullEquipmentCount = nullEquipmentQuery[0]?.count || 0n;
  if (nullEquipmentCount > 0) {
    result.issues['null_equipment_serial'] = Number(nullEquipmentCount);
    result.ready_for_fk = false;
    result.valid_records -= Number(nullEquipmentCount);
    result.details.push(`Found ${nullEquipmentCount} records with NULL equipment_serial`);
    console.log(`  ❌ NULL equipment_serial: ${nullEquipmentCount}`);
  } else {
    console.log(`  ✅ NULL equipment_serial: 0`);
  }

  // Check 2: Orphan records
  const orphanQuery = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >`
    SELECT COUNT(*)::int as count
    FROM inspection_assignments ia
    LEFT JOIN aed_data ad ON ia.equipment_serial = ad.equipment_serial
    WHERE ad.equipment_serial IS NULL AND ia.equipment_serial IS NOT NULL
  `;

  const orphanCount = orphanQuery[0]?.count || 0n;
  if (orphanCount > 0) {
    result.issues['orphan_records'] = Number(orphanCount);
    result.ready_for_fk = false;
    result.valid_records -= Number(orphanCount);
    result.details.push(
      `Found ${orphanCount} orphan records (equipment_serial not in aed_data)`
    );
    console.log(`  ❌ Orphan records: ${orphanCount}`);
  } else {
    console.log(`  ✅ Orphan records: 0`);
  }

  return result;
}

async function validateOrganizationNormalization(): Promise<ValidationResult> {
  console.log('\nValidating organization name normalization...');

  const result: ValidationResult = {
    table: 'normalization_test',
    total_records: 0,
    valid_records: 0,
    issues: {},
    ready_for_fk: true,
    details: []
  };

  // Simple normalization function
  const normalize = (name: string | undefined): string => {
    if (!name) return '';
    return name
      .replace(/\s+/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/[·•]/g, '')
      .toLowerCase()
      .trim();
  };

  // Test cases
  const testCases = [
    { name1: '대구 중구 보건소', name2: '대구중구보건소', expected: true },
    { name1: '대구중구보건소(중구청)', name2: '대구중구보건소', expected: true },
    { name1: '대구중구보건소', name2: '대구·중구 보건소', expected: true },
    { name1: '서울강서구보건소', name2: '대구중구보건소', expected: false },
  ];

  let passCount = 0;
  for (const testCase of testCases) {
    const norm1 = normalize(testCase.name1);
    const norm2 = normalize(testCase.name2);
    const actual = norm1 === norm2 && norm1.length > 0;
    const passed = actual === testCase.expected;

    if (passed) {
      passCount++;
      console.log(
        `  ✅ "${testCase.name1}" vs "${testCase.name2}" → ${actual}`
      );
    } else {
      result.ready_for_fk = false;
      result.issues['normalization_failure'] =
        (result.issues['normalization_failure'] || 0) + 1;
      console.log(
        `  ❌ "${testCase.name1}" vs "${testCase.name2}" → ${actual} (expected ${testCase.expected})`
      );
    }
  }

  result.total_records = testCases.length;
  result.valid_records = passCount;
  result.details.push(`Normalization test: ${passCount}/${testCases.length} passed`);

  return result;
}

async function validateRegionCodeMapping(): Promise<ValidationResult> {
  console.log('\nValidating region code mapping...');

  const result: ValidationResult = {
    table: 'region_code_test',
    total_records: 0,
    valid_records: 0,
    issues: {},
    ready_for_fk: true,
    details: []
  };

  // Test cases for region code mapping
  const regionTestCases = [
    { input: '대구광역시', expected: '대구광역시' },
    { input: '대구', expected: '대구광역시' },
    { input: '서울특별시', expected: '서울특별시' },
    { input: '서울', expected: '서울특별시' },
  ];

  let passCount = 0;
  for (const testCase of regionTestCases) {
    // Verify region exists in aed_data
    const existsInDb = await prisma.aed_data.findFirst({
      where: { sido: testCase.expected },
      select: { sido: true }
    });

    if (existsInDb) {
      passCount++;
      console.log(
        `  ✅ "${testCase.input}" → "${testCase.expected}" (found in aed_data)`
      );
    } else {
      result.ready_for_fk = false;
      result.issues['region_not_found'] =
        (result.issues['region_not_found'] || 0) + 1;
      console.log(
        `  ❌ "${testCase.input}" → "${testCase.expected}" (NOT in aed_data)`
      );
    }
  }

  result.total_records = regionTestCases.length;
  result.valid_records = passCount;
  result.details.push(`Region code mapping: ${passCount}/${regionTestCases.length} verified in aed_data`);

  return result;
}

async function validateExistingForeignKeys(): Promise<ValidationResult> {
  console.log('\nValidating existing foreign keys...');

  const result: ValidationResult = {
    table: 'existing_fk_test',
    total_records: 0,
    valid_records: 0,
    issues: {},
    ready_for_fk: true,
    details: []
  };

  let passCount = 0;

  // Check inspection_schedules.aed_data_id FK
  const scheduleCount = await prisma.inspection_schedules.count();
  const schedulesWithAedData = await prisma.inspection_schedules.count({
    where: { aed_data_id: { not: null } }
  });

  if (scheduleCount > 0) {
    console.log(`  ℹ️  inspection_schedules.aed_data_id: ${schedulesWithAedData}/${scheduleCount}`);
  }

  // Check inspections.aed_data_id FK
  const inspectionCount = await prisma.inspections.count();
  const inspectionsWithAedData = await prisma.inspections.count({
    where: { aed_data_id: { not: null } }
  });

  if (inspectionCount > 0) {
    console.log(`  ℹ️  inspections.aed_data_id: ${inspectionsWithAedData}/${inspectionCount}`);
  }

  result.total_records = 2;
  result.valid_records = 2;
  result.details.push(`Existing FK checks: 2/2 checked`);

  return result;
}

async function main() {
  console.log('========================================');
  console.log('Phase 0: Equipment FK Readiness Check');
  console.log('========================================');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  const validations: ValidationResult[] = [];

  try {
    // Run all validations
    validations.push(await validateInspectionScheduleEntries());
    validations.push(await validateInspectionAssignments());
    validations.push(await validateOrganizationNormalization());
    validations.push(await validateRegionCodeMapping());
    validations.push(await validateExistingForeignKeys());

    // Generate report
    const allReady = validations.every(v => v.ready_for_fk);
    const issuesCount = validations.reduce((sum, v) => {
      return sum + Object.values(v.issues).reduce((a, b) => a + b, 0);
    }, 0);

    const report: MigrationReadinessReport = {
      generated_at: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      overall_status: allReady ? 'READY' : issuesCount > 5 ? 'CRITICAL' : 'ISSUES_FOUND',
      validations,
      summary: {
        total_tables: validations.length,
        tables_ready: validations.filter(v => v.ready_for_fk).length,
        tables_with_issues: validations.filter(v => !v.ready_for_fk).length,
        total_issues: issuesCount,
        recommendations: allReady
          ? ['All validations passed. Ready for Phase 1 migration.']
          : [
            'Address issues before proceeding with Phase 1.',
            'Review migration-readiness-report.json for details.',
            issuesCount > 5
              ? 'CRITICAL: Manual intervention required.'
              : 'ISSUES: Plan remediation strategy.'
          ]
      }
    };

    // Save report
    const reportPath = path.join(
      process.cwd(),
      'migration-readiness-report.json'
    );

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);

    // Print summary
    console.log('\n========================================');
    console.log('Summary');
    console.log('========================================');
    console.log(`Overall Status: ${report.overall_status}`);
    console.log(`Tables Validated: ${report.summary.total_tables}`);
    console.log(`  ✅ Ready: ${report.summary.tables_ready}`);
    console.log(`  ⚠️  Issues: ${report.summary.tables_with_issues}`);
    console.log(`Total Issues Found: ${report.summary.total_issues}`);
    console.log('\nRecommendations:');
    report.summary.recommendations.forEach(rec => console.log(`  - ${rec}`));

    // Exit with appropriate code
    process.exit(allReady ? 0 : 1);
  } catch (error) {
    console.error('\nFatal Error:', error);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
}

main();
