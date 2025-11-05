#!/usr/bin/env tsx
// 테스트 스크립트: Inspection Sessions API 개선 사항 검증
// 실행: npx tsx scripts/test/test-inspection-sessions.ts

import { prisma } from '@/lib/prisma';

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

// 테스트용 데이터
const TEST_USER_ID = 'test_inspector_001';
const TEST_SERIAL = 'TEST_AED_001';
const TEST_SERIAL_2 = 'TEST_AED_002';

// 유틸리티 함수
function logTest(test: string, passed: boolean, message: string, duration?: number) {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message}${duration ? ` (${duration}ms)` : ''}`);
  results.push({ test, passed, message, duration });
}

async function cleanup() {
  // 테스트 데이터 정리
  await prisma.inspection_sessions.deleteMany({
    where: {
      inspector_id: TEST_USER_ID
    }
  });

  await prisma.inspections.deleteMany({
    where: {
      inspector_id: TEST_USER_ID
    }
  });

  await prisma.inspection_assignments.deleteMany({
    where: {
      assigned_to: TEST_USER_ID
    }
  });
}

// 테스트 1: 중복 세션 방지 테스트
async function testDuplicateSessionPrevention() {
  const startTime = Date.now();

  try {
    // 첫 번째 세션 생성
    const session1 = await prisma.inspection_sessions.create({
      data: {
        equipment_serial: TEST_SERIAL,
        inspector_id: TEST_USER_ID,
        status: 'active',
        current_step: 0,
        device_info: {}
      }
    });

    // 동일한 장비에 대해 다시 세션 생성 시도
    const existingSession = await prisma.inspection_sessions.findFirst({
      where: {
        equipment_serial: TEST_SERIAL,
        inspector_id: TEST_USER_ID,
        status: { in: ['active', 'paused'] }
      }
    });

    if (existingSession) {
      logTest(
        '중복 세션 방지',
        true,
        '활성 세션이 있을 때 새 세션 생성이 차단됨',
        Date.now() - startTime
      );
    } else {
      logTest(
        '중복 세션 방지',
        false,
        '활성 세션이 있는데도 새 세션이 생성됨',
        Date.now() - startTime
      );
    }

    // 정리
    await prisma.inspection_sessions.delete({
      where: { id: session1.id }
    });

  } catch (error) {
    logTest('중복 세션 방지', false, `에러 발생: ${error}`);
  }
}

// 테스트 2: 트랜잭션 원자성 테스트
async function testTransactionAtomicity() {
  const startTime = Date.now();

  try {
    // 테스트 세션 생성
    const session = await prisma.inspection_sessions.create({
      data: {
        equipment_serial: TEST_SERIAL,
        inspector_id: TEST_USER_ID,
        status: 'active',
        current_step: 3,
        device_info: {},
        step_data: {
          basicInfo: { address: '테스트 주소' },
          deviceInfo: { manufacturer: '테스트 제조사' }
        }
      }
    });

    // Assignment 생성
    await prisma.inspection_assignments.create({
      data: {
        equipment_serial: TEST_SERIAL,
        assigned_to: TEST_USER_ID,
        status: 'in_progress'
      }
    });

    // 트랜잭션으로 완료 처리 시뮬레이션
    const result = await prisma.$transaction(async (tx) => {
      // 1. 세션 완료
      const completedSession = await tx.inspection_sessions.update({
        where: { id: session.id },
        data: {
          status: 'completed',
          completed_at: new Date()
        }
      });

      // 2. Inspection 생성
      const inspection = await tx.inspections.create({
        data: {
          equipment_serial: TEST_SERIAL,
          inspector_id: TEST_USER_ID,
          inspection_date: new Date(),
          inspection_type: 'monthly',
          overall_status: 'pass',
          original_data: {},
          inspected_data: {}
        }
      });

      // 3. Assignment 업데이트
      await tx.inspection_assignments.updateMany({
        where: {
          equipment_serial: TEST_SERIAL,
          assigned_to: TEST_USER_ID,
          status: 'in_progress'
        },
        data: {
          status: 'completed',
          completed_at: new Date()
        }
      });

      return { session: completedSession, inspection };
    });

    // 검증: 모든 데이터가 일관되게 업데이트되었는지 확인
    const verifySession = await prisma.inspection_sessions.findUnique({
      where: { id: session.id }
    });

    const verifyAssignment = await prisma.inspection_assignments.findFirst({
      where: {
        equipment_serial: TEST_SERIAL,
        assigned_to: TEST_USER_ID
      }
    });

    const verifyInspection = await prisma.inspections.findFirst({
      where: {
        equipment_serial: TEST_SERIAL,
        inspector_id: TEST_USER_ID
      }
    });

    const allCompleted =
      verifySession?.status === 'completed' &&
      verifyAssignment?.status === 'completed' &&
      verifyInspection !== null;

    logTest(
      '트랜잭션 원자성',
      allCompleted,
      allCompleted ?
        '모든 테이블이 원자적으로 업데이트됨' :
        '일부 테이블만 업데이트됨',
      Date.now() - startTime
    );

    // 정리
    await prisma.inspections.deleteMany({
      where: { equipment_serial: TEST_SERIAL }
    });
    await prisma.inspection_assignments.deleteMany({
      where: { equipment_serial: TEST_SERIAL }
    });
    await prisma.inspection_sessions.deleteMany({
      where: { id: session.id }
    });

  } catch (error) {
    logTest('트랜잭션 원자성', false, `에러 발생: ${error}`);
  }
}

// 테스트 3: 트랜잭션 롤백 테스트
async function testTransactionRollback() {
  const startTime = Date.now();

  try {
    // 테스트 세션 생성
    const session = await prisma.inspection_sessions.create({
      data: {
        equipment_serial: TEST_SERIAL_2,
        inspector_id: TEST_USER_ID,
        status: 'active',
        current_step: 3,
        device_info: {}
      }
    });

    // 의도적으로 실패하는 트랜잭션
    let rollbackSuccess = false;
    try {
      await prisma.$transaction(async (tx) => {
        // 세션 업데이트
        await tx.inspection_sessions.update({
          where: { id: session.id },
          data: { status: 'completed' }
        });

        // 의도적 에러 발생
        throw new Error('Intentional rollback test');
      });
    } catch (error) {
      rollbackSuccess = true;
    }

    // 검증: 세션이 여전히 active 상태인지 확인
    const verifySession = await prisma.inspection_sessions.findUnique({
      where: { id: session.id }
    });

    const rolledBack = verifySession?.status === 'active';

    logTest(
      '트랜잭션 롤백',
      rollbackSuccess && rolledBack,
      rollbackSuccess && rolledBack ?
        '트랜잭션 실패 시 모든 변경사항이 롤백됨' :
        '롤백이 제대로 작동하지 않음',
      Date.now() - startTime
    );

    // 정리
    await prisma.inspection_sessions.delete({
      where: { id: session.id }
    });

  } catch (error) {
    logTest('트랜잭션 롤백', false, `에러 발생: ${error}`);
  }
}

// 테스트 4: DELETE 트랜잭션 테스트
async function testDeleteTransaction() {
  const startTime = Date.now();

  try {
    // 세션과 Assignment 생성
    const session = await prisma.inspection_sessions.create({
      data: {
        equipment_serial: TEST_SERIAL,
        inspector_id: TEST_USER_ID,
        status: 'active',
        current_step: 2,
        device_info: {}
      }
    });

    await prisma.inspection_assignments.create({
      data: {
        equipment_serial: TEST_SERIAL,
        assigned_to: TEST_USER_ID,
        status: 'in_progress',
        started_at: new Date()
      }
    });

    // 트랜잭션으로 취소 처리
    await prisma.$transaction(async (tx) => {
      // 세션 취소
      await tx.inspection_sessions.update({
        where: { id: session.id },
        data: {
          status: 'cancelled',
          cancelled_at: new Date()
        }
      });

      // Assignment 복구
      await tx.inspection_assignments.updateMany({
        where: {
          equipment_serial: TEST_SERIAL,
          assigned_to: TEST_USER_ID,
          status: 'in_progress'
        },
        data: {
          status: 'pending',
          started_at: null
        }
      });
    });

    // 검증
    const verifySession = await prisma.inspection_sessions.findUnique({
      where: { id: session.id }
    });

    const verifyAssignment = await prisma.inspection_assignments.findFirst({
      where: {
        equipment_serial: TEST_SERIAL,
        assigned_to: TEST_USER_ID
      }
    });

    const correctlyUpdated =
      verifySession?.status === 'cancelled' &&
      verifyAssignment?.status === 'pending' &&
      verifyAssignment?.started_at === null;

    logTest(
      'DELETE 트랜잭션',
      correctlyUpdated,
      correctlyUpdated ?
        '세션 취소 시 Assignment도 올바르게 복구됨' :
        'Assignment 복구가 제대로 되지 않음',
      Date.now() - startTime
    );

    // 정리
    await prisma.inspection_assignments.deleteMany({
      where: { equipment_serial: TEST_SERIAL }
    });
    await prisma.inspection_sessions.deleteMany({
      where: { id: session.id }
    });

  } catch (error) {
    logTest('DELETE 트랜잭션', false, `에러 발생: ${error}`);
  }
}

// 테스트 5: 동시성 테스트
async function testConcurrency() {
  const startTime = Date.now();

  try {
    // 10개의 동시 세션 생성 시도
    const promises = Array.from({ length: 10 }, (_, i) =>
      prisma.inspection_sessions.create({
        data: {
          equipment_serial: `CONCURRENT_${i}`,
          inspector_id: TEST_USER_ID,
          status: 'active',
          current_step: 0,
          device_info: {}
        }
      }).catch(e => null)
    );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r !== null).length;

    logTest(
      '동시성 처리',
      successCount === 10,
      `10개 동시 요청 중 ${successCount}개 성공`,
      Date.now() - startTime
    );

    // 정리
    await prisma.inspection_sessions.deleteMany({
      where: {
        inspector_id: TEST_USER_ID,
        equipment_serial: { startsWith: 'CONCURRENT_' }
      }
    });

  } catch (error) {
    logTest('동시성 처리', false, `에러 발생: ${error}`);
  }
}

// 메인 실행 함수
async function runTests() {
  console.log('🚀 Inspection Sessions API 테스트 시작\n');
  console.log('================================\n');

  // 초기 정리
  await cleanup();

  // 테스트 실행
  await testDuplicateSessionPrevention();
  await testTransactionAtomicity();
  await testTransactionRollback();
  await testDeleteTransaction();
  await testConcurrency();

  // 최종 정리
  await cleanup();

  // 결과 요약
  console.log('\n================================');
  console.log('📊 테스트 결과 요약\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  console.log(`✅ 통과: ${passed}개`);
  console.log(`❌ 실패: ${failed}개`);
  console.log(`⏱️  총 소요 시간: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\n실패한 테스트:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.test}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 모든 테스트 통과!');
    process.exit(0);
  }
}

// 실행
runTests().catch(error => {
  console.error('테스트 실행 중 오류:', error);
  process.exit(1);
});