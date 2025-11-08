#!/usr/bin/env npx tsx
/**
 * 미완료 점검 데이터 정리
 *
 * 문제: 7건의 점검이 completed_at이 null인 상태로 방치
 * 해결:
 * 1. 중복 레코드 제거
 * 2. 미완료 점검을 inspection_assignments에 추가
 * 3. 상태를 'in_progress'로 설정하여 계속할 수 있게 함
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// 환경변수 로드 (DATABASE_URL이 이미 설정되면 .env.local 무시)
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

const prisma = new PrismaClient();

async function fixIncompleteInspections() {
  try {
    console.log('🔧 미완료 점검 데이터 정리\n');

    // 최근 3개월 내 미완료 점검 조회
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const incompleteInspections = await prisma.inspections.findMany({
      where: {
        inspection_date: {
          gte: threeMonthsAgo
        },
        completed_at: null
      },
      include: {
        user_profiles: {
          select: {
            full_name: true,
            email: true,
            organization_name: true
          }
        }
      }
    });

    console.log(`📋 미완료 점검: ${incompleteInspections.length}건\n`);

    // 장비별로 그룹화하여 중복 확인
    const byEquipment = incompleteInspections.reduce((acc, insp) => {
      const key = `${insp.equipment_serial}_${insp.inspector_id}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(insp);
      return acc;
    }, {} as Record<string, typeof incompleteInspections>);

    let createdCount = 0;
    let deletedCount = 0;

    for (const [key, inspections] of Object.entries(byEquipment)) {
      if (inspections.length > 1) {
        console.log(`🔄 중복 발견: ${inspections[0].equipment_serial} (${inspections.length}건)`);

        // 가장 오래된 것만 남기고 나머지 삭제
        const sorted = inspections.sort((a, b) =>
          new Date(a.inspection_date).getTime() - new Date(b.inspection_date).getTime()
        );

        const keep = sorted[0];
        const deleteIds = sorted.slice(1).map(i => i.id);

        // 중복 삭제
        await prisma.inspections.deleteMany({
          where: { id: { in: deleteIds } }
        });

        deletedCount += deleteIds.length;
        console.log(`   ✅ ${deleteIds.length}개 중복 제거`);
      }

      // inspection_assignments 생성 또는 업데이트
      const inspection = inspections[0];

      // 기존 assignment 확인
      const existing = await prisma.inspection_assignments.findFirst({
        where: {
          equipment_serial: inspection.equipment_serial,
          assigned_to: inspection.inspector_id
        }
      });

      if (!existing) {
        // 새로운 assignment 생성
        await prisma.inspection_assignments.create({
          data: {
            equipment_serial: inspection.equipment_serial,
            assigned_to: inspection.inspector_id,
            assigned_by: inspection.inspector_id,
            assignment_type: 'immediate',
            status: 'in_progress', // 진행 중 상태로 설정
            priority_level: 1,
            notes: '미완료 점검 복구 (시스템 정리)',
            started_at: inspection.inspection_date,
            created_at: inspection.created_at || inspection.inspection_date
          }
        });

        createdCount++;
        console.log(`   ✅ Assignment 생성: ${inspection.equipment_serial}`);
      } else if (existing.status === 'pending') {
        // 기존 assignment를 in_progress로 업데이트
        await prisma.inspection_assignments.update({
          where: { id: existing.id },
          data: {
            status: 'in_progress',
            started_at: inspection.inspection_date
          }
        });

        console.log(`   ✅ Assignment 업데이트: ${inspection.equipment_serial} → in_progress`);
      }
    }

    console.log('\n📊 정리 결과:');
    console.log(`   중복 제거: ${deletedCount}건`);
    console.log(`   Assignment 생성: ${createdCount}건`);
    console.log(`   총 처리: ${Object.keys(byEquipment).length}개 장비`);

    // 최종 확인
    const remaining = await prisma.inspections.count({
      where: {
        inspection_date: { gte: threeMonthsAgo },
        completed_at: null
      }
    });

    console.log(`\n📌 남은 미완료 점검: ${remaining}건`);

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
fixIncompleteInspections()
  .catch(console.error)
  .finally(() => process.exit());