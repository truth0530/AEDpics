import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

// 사용자 입력 대기 함수
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function cleanupDuplicateSessions() {
  try {
    console.log('=== 중복 세션 정리 스크립트 ===\n');

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

    let totalDeleted = 0;
    const deletionDetails = [];

    for (const serial of duplicateSerials) {
      const sessions = await prisma.inspection_sessions.findMany({
        where: { equipment_serial: serial },
        select: {
          id: true,
          status: true,
          started_at: true,
          user_profiles: { select: { full_name: true } }
        },
        orderBy: { started_at: 'desc' }
      });

      if (sessions.length > 1) {
        console.log(`\n📊 ${serial}`);
        console.log(`현재 세션: ${sessions.length}개\n`);

        // 가장 최신 세션 1개 제외 (이것만 유지)
        const sessionsToDelete = sessions.slice(1);

        sessions.forEach((s, idx) => {
          const action = idx === 0 ? '✅ 유지' : '❌ 삭제';
          console.log(`${action} - 상태: ${s.status}, 점검자: ${s.user_profiles?.full_name}`);
          console.log(`       시작: ${s.started_at}`);
        });

        deletionDetails.push({
          equipment_serial: serial,
          keepSessionId: sessions[0].id,
          deleteSessionIds: sessionsToDelete.map(s => s.id),
          deleteCount: sessionsToDelete.length
        });
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`\n📋 정리 계획 요약:`);
    console.log(`총 ${deletionDetails.length}개 장비에서 ${deletionDetails.reduce((sum, d) => sum + d.deleteCount, 0)}개 세션 삭제 예정\n`);

    deletionDetails.forEach(detail => {
      console.log(`${detail.equipment_serial}: ${detail.deleteCount}개 세션 삭제`);
    });

    // 확인 요청
    const confirm = await askQuestion(`\n⚠️  위 세션들을 삭제하시겠습니까? (yes/no): `);

    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ 취소되었습니다.');
      await prisma.$disconnect();
      return;
    }

    // 실제 삭제 수행
    console.log('\n🔄 삭제 진행 중...\n');

    for (const detail of deletionDetails) {
      for (const sessionId of detail.deleteSessionIds) {
        await prisma.inspection_sessions.delete({
          where: { id: sessionId }
        });
        totalDeleted++;
      }
      console.log(`✅ ${detail.equipment_serial}: ${detail.deleteCount}개 세션 삭제 완료`);
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`\n✨ 정리 완료!`);
    console.log(`총 ${totalDeleted}개 세션이 삭제되었습니다.\n`);

    // 정리 후 상태 확인
    console.log('🔍 정리 후 상태 확인:');
    let remainingSessions = 0;
    for (const serial of duplicateSerials) {
      const sessions = await prisma.inspection_sessions.findMany({
        where: {
          equipment_serial: serial,
          status: { in: ['active', 'paused'] }
        }
      });
      if (sessions.length > 1) {
        console.log(`⚠️  ${serial}: 여전히 ${sessions.length}개 세션 존재`);
        remainingSessions++;
      }
    }

    if (remainingSessions === 0) {
      console.log('✅ 모든 중복 세션이 정리되었습니다!');
    }

  } catch (error) {
    console.error('오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicateSessions();
