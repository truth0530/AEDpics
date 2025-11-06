/**
 * Fix Missing aed_data FK in Inspections
 *
 * 문제: aed_data_id FK가 NULL인 inspection 레코드들을 정리
 * - equipment_serial로 aed_data를 조회하여 FK를 설정
 * - aed_data에 없는 장비는 그대로 NULL 유지
 *
 * 실행: npx tsx scripts/migrations/fix-inspection-aed-fk.ts
 */

import { prisma } from '@/lib/prisma';

async function fixInspectionAedFk() {
  console.log('========================================');
  console.log('Fixing Missing aed_data FK in Inspections');
  console.log('========================================\n');

  try {
    // 1. FK가 NULL인 inspection 조회
    const missingFkInspections = await prisma.inspections.findMany({
      where: { aed_data_id: null },
      select: { id: true, equipment_serial: true, created_at: true }
    });

    console.log(`Found ${missingFkInspections.length} inspections with missing FK\n`);

    if (missingFkInspections.length === 0) {
      console.log('✅ No missing FKs found. Database is clean.');
      return;
    }

    // 2. 각 inspection의 equipment_serial로 aed_data 조회
    let fixedCount = 0;
    let notFoundCount = 0;

    for (const inspection of missingFkInspections) {
      try {
        const aedData = await prisma.aed_data.findUnique({
          where: { equipment_serial: inspection.equipment_serial },
          select: { id: true }
        });

        if (aedData) {
          // FK 업데이트
          await prisma.inspections.update({
            where: { id: inspection.id },
            data: { aed_data_id: aedData.id }
          });
          fixedCount++;
          console.log(`✅ Fixed: ${inspection.equipment_serial}`);
        } else {
          notFoundCount++;
          console.log(`⚠️  No aed_data: ${inspection.equipment_serial}`);
        }
      } catch (error) {
        console.error(`❌ Error fixing ${inspection.id}:`, error instanceof Error ? error.message : error);
      }
    }

    console.log('\n========================================');
    console.log('Migration Results:');
    console.log('----------------------------------------');
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Not Found (FK stays NULL): ${notFoundCount}`);
    console.log(`Total: ${fixedCount + notFoundCount}`);
    console.log('========================================\n');

    // 3. 최종 검증
    const remainingNull = await prisma.inspections.count({
      where: { aed_data_id: null }
    });

    console.log(`Remaining NULL FKs: ${remainingNull}`);
    if (remainingNull === notFoundCount) {
      console.log('✅ Migration successful - only expected NULL FKs remain');
    }

  } catch (error) {
    console.error('Error during migration:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixInspectionAedFk();
