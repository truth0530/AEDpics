import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

// CLI 인자 파싱
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const apply = args.includes('--apply');
const force = args.includes('--force');

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

/**
 * 데이터베이스에서 중복 세션을 동적으로 감지합니다.
 * @returns {Promise<Array>} 중복이 있는 장비 목록
 */
async function findDuplicateEquipment() {
  try {
    const duplicates = await prisma.$queryRaw`
      SELECT
        equipment_serial,
        COUNT(*) as session_count,
        STRING_AGG(id, ',') as session_ids
      FROM aedpics.inspection_sessions
      WHERE status IN ('active', 'paused')
      GROUP BY equipment_serial
      HAVING COUNT(*) > 1
      ORDER BY session_count DESC
    `;

    return duplicates || [];
  } catch (error) {
    console.error('데이터베이스 쿼리 오류:', error);
    return [];
  }
}

async function cleanupDuplicateSessions() {
  try {
    console.log('=== 중복 세션 정리 스크립트 (v2) ===\n');

    // Step 1: 동적으로 중복 장비 감지
    console.log('🔍 중복 세션을 감지하는 중...\n');
    const duplicateEquipment = await findDuplicateEquipment();

    if (duplicateEquipment.length === 0) {
      console.log('✅ 중복 세션이 없습니다! 정리할 항목이 없습니다.\n');
      await prisma.$disconnect();
      return;
    }

    console.log(`찾음: ${duplicateEquipment.length}개 장비에서 중복 세션 감지\n`);

    // Step 2: 각 장비의 상세 정보 수집
    const duplicateSerials = duplicateEquipment.map(d => d.equipment_serial);

    let totalDeleted = 0;
    const deletionDetails = [];

    // Step 3: 각 장비의 세션 상세 조회
    console.log('📝 세션 상세 정보 수집 중...\n');
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
        console.log(`    세션 개수: ${sessions.length}개`);

        // 가장 최신 세션 1개 제외 (이것만 유지)
        const sessionsToDelete = sessions.slice(1);

        console.log(`\n    유지할 세션:`);
        const keepSession = sessions[0];
        console.log(`      ✅ ID: ${keepSession.id.substring(0, 8)}...`);
        console.log(`         상태: ${keepSession.status}, 점검자: ${keepSession.user_profiles?.full_name || '미지정'}`);
        console.log(`         시작: ${new Date(keepSession.started_at).toISOString()}`);

        console.log(`\n    삭제할 세션:`);
        sessionsToDelete.forEach((s, idx) => {
          console.log(`      ❌ [${idx + 1}] ID: ${s.id.substring(0, 8)}...`);
          console.log(`            상태: ${s.status}, 점검자: ${s.user_profiles?.full_name || '미지정'}`);
          console.log(`            시작: ${new Date(s.started_at).toISOString()}`);
        });

        deletionDetails.push({
          equipment_serial: serial,
          keepSessionId: sessions[0].id,
          deleteSessionIds: sessionsToDelete.map(s => s.id),
          deleteCount: sessionsToDelete.length
        });
      }
    }

    const totalDeleteCount = deletionDetails.reduce((sum, d) => sum + d.deleteCount, 0);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📋 정리 계획 요약:`);
    console.log(`   총 ${deletionDetails.length}개 장비`);
    console.log(`   총 ${totalDeleteCount}개 세션 삭제 예정\n`);

    deletionDetails.forEach(detail => {
      console.log(`   • ${detail.equipment_serial}: ${detail.deleteCount}개 세션 삭제`);
    });

    // Dry-run 모드인 경우 여기서 종료
    if (dryRun) {
      console.log(`\n${'='.repeat(60)}`);
      console.log('\n🔍 Dry-run 모드: 실제 삭제를 수행하지 않았습니다.');
      console.log('실제 삭제를 수행하려면 다음 명령을 실행하세요:');
      console.log('  node scripts/cleanup_duplicate_sessions.mjs --apply\n');
      await prisma.$disconnect();
      return;
    }

    // 확인 요청 (force 플래그가 없으면)
    if (!force && !apply) {
      const confirm = await askQuestion(`\n⚠️  위 세션들을 삭제하시겠습니까? (yes/no): `);

      if (confirm.toLowerCase() !== 'yes') {
        console.log('\n❌ 취소되었습니다.');
        await prisma.$disconnect();
        return;
      }
    }

    // Step 4: 실제 삭제 수행
    console.log(`\n${'='.repeat(60)}`);
    console.log('\n🔄 삭제 진행 중...\n');

    for (let i = 0; i < deletionDetails.length; i++) {
      const detail = deletionDetails[i];
      const progressPercent = Math.round(((i + 1) / deletionDetails.length) * 100);

      for (const sessionId of detail.deleteSessionIds) {
        try {
          await prisma.inspection_sessions.delete({
            where: { id: sessionId }
          });
          totalDeleted++;
        } catch (error) {
          console.error(`   ❌ ${detail.equipment_serial} 삭제 실패:`, error.message);
        }
      }

      console.log(`   [${progressPercent.toString().padStart(3)}%] ✅ ${detail.equipment_serial}: ${detail.deleteCount}개 세션 삭제 완료`);
    }

    // Step 5: 결과 요약
    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n✨ 정리 완료!`);
    console.log(`   총 ${totalDeleted}개 세션이 삭제되었습니다.\n`);

    // Step 6: 정리 후 검증 (정말 중복이 없는지 확인)
    console.log('🔍 정리 후 중복 여부 검증 중...\n');
    const remainingDuplicates = await findDuplicateEquipment();

    if (remainingDuplicates.length === 0) {
      console.log('✅ 모든 중복 세션이 정리되었습니다!');
      console.log('   이제 마이그레이션을 적용할 준비가 되었습니다.\n');
    } else {
      console.log(`⚠️  경고: 여전히 ${remainingDuplicates.length}개 장비에서 중복이 감지됩니다:`);
      remainingDuplicates.forEach(dup => {
        console.log(`   • ${dup.equipment_serial}: ${dup.session_count}개 세션`);
      });
      console.log();
    }

  } catch (error) {
    console.error('오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicateSessions();
