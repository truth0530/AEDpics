import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDuplicateSessions() {
  try {
    // 모든 활성/일시정지 점검 세션 조회
    const allSessions = await prisma.inspection_sessions.findMany({
      where: {
        status: {
          in: ['active', 'paused']
        }
      },
      include: {
        user_profiles: {
          select: {
            full_name: true,
            email: true
          }
        }
      },
      orderBy: [
        { equipment_serial: 'asc' },
        { started_at: 'desc' }
      ]
    });

    // 장비별로 그룹화
    const grouped = {};
    allSessions.forEach(session => {
      if (!grouped[session.equipment_serial]) {
        grouped[session.equipment_serial] = [];
      }
      grouped[session.equipment_serial].push(session);
    });

    // 분석
    const withMultipleSessions = Object.entries(grouped).filter(([, sessions]) => sessions.length > 1);
    const summary = {
      totalActiveSessions: allSessions.length,
      equipmentWithSessions: Object.keys(grouped).length,
      equipmentWithMultipleSessions: withMultipleSessions.length,
      details: []
    };

    console.log('\n=== 점검 세션 현황 분석 ===\n');
    console.log(`총 활성/일시정지 세션: ${summary.totalActiveSessions}개`);
    console.log(`세션이 있는 장비: ${summary.equipmentWithSessions}개`);
    console.log(`중복 세션 장비: ${summary.equipmentWithMultipleSessions}개\n`);

    if (withMultipleSessions.length > 0) {
      console.log('=== 중복 세션 장비 ===\n');
      withMultipleSessions.forEach(([serial, sessions]) => {
        console.log(`🔧 ${serial} (${sessions.length}개 세션)`);
        sessions.forEach((session, idx) => {
          console.log(`   ${idx + 1}. ID: ${session.id}`);
          console.log(`      상태: ${session.status}`);
          console.log(`      점검자: ${session.user_profiles?.full_name}`);
          console.log(`      시작: ${session.started_at}`);
          console.log(`      완료: ${session.completed_at || '진행중'}`);
        });
        console.log();
      });
    }

    // 점검대상에 포함되면 안 될 장비들
    console.log('=== 점검대상에서 제외되어야 할 장비 ===\n');
    Object.entries(grouped).forEach(([serial, sessions]) => {
      // active 또는 paused 상태의 세션이 있으면 점검대상에서 제외
      const hasActiveSessions = sessions.some(s => s.status === 'active' || s.status === 'paused');
      if (hasActiveSessions) {
        console.log(`${serial} - 상태: ${sessions[0].status}`);
      }
    });

    console.log(`\n총 ${summary.equipmentWithSessions}개의 장비가 점검대상 탭에서 제외되어야 합니다.\n`);

    return summary;

  } catch (error) {
    console.error('오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const result = await findDuplicateSessions();
process.exit(result ? 0 : 1);
