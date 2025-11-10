import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeDuplicatePattern() {
  try {
    console.log('=== 중복 세션과 점검 이력 상세 분석 ===\n');

    // 중복 세션이 있는 10개 장비
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

    // 각 장비의 세션과 점검 기록 비교
    let sessionsWithoutInspection = 0;
    let inspectionsWithDuplicateSessions = 0;

    for (const serial of duplicateSerials) {
      // 세션 조회
      const sessions = await prisma.inspection_sessions.findMany({
        where: {
          equipment_serial: serial,
          status: { in: ['active', 'paused'] }
        },
        select: {
          id: true,
          status: true,
          started_at: true,
          completed_at: true,
          user_profiles: { select: { full_name: true } }
        },
        orderBy: { started_at: 'desc' }
      });

      // 점검 기록 조회
      const inspections = await prisma.inspections.findMany({
        where: { equipment_serial: serial },
        select: {
          id: true,
          inspection_date: true,
          overall_status: true,
          user_profiles: { select: { full_name: true } }
        },
        orderBy: { inspection_date: 'desc' }
      });

      if (sessions.length > 1 || inspections.length > 1) {
        console.log(`📊 ${serial}`);
        console.log(`   세션: ${sessions.length}개 | 점검 기록: ${inspections.length}개`);

        if (sessions.length > 0) {
          console.log(`   \n   [진행 중인 세션]`);
          sessions.forEach((s, idx) => {
            console.log(`   ${idx + 1}. 상태: ${s.status}, 점검자: ${s.user_profiles?.full_name}`);
            console.log(`      시작: ${s.started_at}`);
          });
        }

        if (inspections.length > 0) {
          console.log(`   \n   [완료된 점검 기록]`);
          inspections.forEach((i, idx) => {
            console.log(`   ${idx + 1}. 점검자: ${i.user_profiles?.full_name}, 점검일: ${i.inspection_date}`);
            console.log(`      상태: ${i.overall_status}`);
          });
        }

        // 이상 플래그
        if (sessions.length > 1 && inspections.length > 0) {
          console.log(`   \n   ⚠️ 이상: 중복 세션이 있는데 이미 점검 기록이 존재함!`);
          inspectionsWithDuplicateSessions++;
        }

        if (sessions.length > 1 && inspections.length === 0) {
          console.log(`   \n   ⚠️ 이상: 중복 세션만 있고 점검 기록이 없음`);
          sessionsWithoutInspection++;
        }

        console.log();
      }
    }

    // 전체 요약
    console.log(`\n=== 최종 분석 ===`);
    console.log(`중복 세션 있는 장비 중:`);
    console.log(`  • 이미 완료된 점검이 있는데 세션이 중복: ${inspectionsWithDuplicateSessions}개`);
    console.log(`  • 세션만 중복되고 완료 기록 없음: ${sessionsWithoutInspection}개`);

  } catch (error) {
    console.error('오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeDuplicatePattern();
