import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDuplicateInspections() {
  try {
    // 중복 세션이 있는 10개 장비 목록
    const duplicateSerials = [
      '11-0010656',
      '11-0020515',
      '11-0040123',
      '11-0042714',
      '11-0077308',
      '13-0000485',
      '13-0000493',
      '18-0000067',
      '18-0000070',
      '29-0000935'
    ];

    console.log('=== 중복 세션 장비의 점검 이력 분석 ===\n');

    let totalInspections = 0;
    let equipmentWithMultipleInspections = 0;

    for (const serial of duplicateSerials) {
      const inspections = await prisma.inspections.findMany({
        where: { equipment_serial: serial },
        select: {
          id: true,
          equipment_serial: true,
          inspector_id: true,
          inspection_date: true,
          overall_status: true,
          created_at: true,
          user_profiles: {
            select: {
              full_name: true,
              email: true
            }
          }
        },
        orderBy: { inspection_date: 'desc' }
      });

      if (inspections.length > 0) {
        totalInspections += inspections.length;
        if (inspections.length > 1) {
          equipmentWithMultipleInspections++;
        }

        console.log(`🔧 ${serial} (${inspections.length}개 점검 이력)`);
        inspections.forEach((insp, index) => {
          console.log(`   ${index + 1}. ID: ${insp.id}`);
          console.log(`      점검자: ${insp.user_profiles?.full_name || '알 수 없음'}`);
          console.log(`      점검일: ${insp.inspection_date}`);
          console.log(`      상태: ${insp.overall_status}`);
        });
        console.log();
      }
    }

    console.log(`\n=== 요약 ===`);
    console.log(`중복 세션 장비: ${duplicateSerials.length}개`);
    console.log(`총 점검 이력: ${totalInspections}개`);
    console.log(`여러 번 점검한 장비: ${equipmentWithMultipleInspections}개`);

  } catch (error) {
    console.error('오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findDuplicateInspections();
