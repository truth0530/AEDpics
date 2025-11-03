/**
 * Backfill aed_data.last_inspection_date from existing inspections
 *
 * 이 스크립트는 기존 점검 데이터를 기반으로 aed_data 테이블의
 * last_inspection_date를 업데이트합니다.
 *
 * Usage: npx ts-node scripts/backfill-inspection-dates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillInspectionDates() {
  console.log('Starting backfill of aed_data.last_inspection_date...\n');

  try {
    // 1. 모든 점검 데이터를 equipment_serial별로 그룹화하여 최근 점검일 조회
    const inspections = await prisma.inspections.groupBy({
      by: ['equipment_serial'],
      _max: {
        inspection_date: true
      }
    });

    console.log(`Found ${inspections.length} equipment with inspections\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors: { serial: string; error: string }[] = [];

    // 2. 각 장비의 last_inspection_date 업데이트
    for (const inspection of inspections) {
      const serial = inspection.equipment_serial;
      const lastDate = inspection._max.inspection_date;

      if (!lastDate) {
        console.log(`⚠️  ${serial}: No inspection date found, skipping`);
        continue;
      }

      try {
        // aed_data 테이블 업데이트
        const result = await prisma.aed_data.update({
          where: { equipment_serial: serial },
          data: {
            last_inspection_date: lastDate
          }
        });

        successCount++;
        console.log(`✅ ${serial}: Updated to ${lastDate.toISOString()}`);
      } catch (error: any) {
        errorCount++;
        const errorMessage = error.message || 'Unknown error';
        errors.push({ serial, error: errorMessage });
        console.log(`❌ ${serial}: ${errorMessage}`);
      }
    }

    // 3. 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('Backfill Summary:');
    console.log(`  Total equipment: ${inspections.length}`);
    console.log(`  Successfully updated: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log('='.repeat(60));

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(({ serial, error }) => {
        console.log(`  ${serial}: ${error}`);
      });
    }

    // 4. 검증: last_inspection_date가 설정된 장비 수 확인
    const verifyCount = await prisma.aed_data.count({
      where: {
        last_inspection_date: { not: null }
      }
    });

    console.log(`\nVerification: ${verifyCount} equipment now have last_inspection_date set`);

  } catch (error) {
    console.error('Fatal error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute
backfillInspectionDates()
  .then(() => {
    console.log('\n✅ Backfill completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });
