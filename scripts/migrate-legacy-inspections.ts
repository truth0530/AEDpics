#!/usr/bin/env npx tsx
/**
 * 레거시 점검 데이터 마이그레이션 스크립트
 *
 * 목적: 기존 inspections 테이블 데이터를 inspection_assignments로 마이그레이션
 * 실행: npm run migrate:legacy-inspections
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// 환경변수 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function migrateLegacyInspections() {
  try {
    console.log('🔄 레거시 점검 데이터 마이그레이션 시작...\n');

    // 1. 최근 6개월 점검 데이터 조회 (너무 오래된 데이터는 제외)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const legacyInspections = await prisma.inspections.findMany({
      where: {
        inspection_date: {
          gte: sixMonthsAgo
        }
      },
      select: {
        id: true,
        equipment_serial: true,
        inspector_id: true,
        inspection_date: true,
        completed_at: true,
        created_at: true
      }
    });

    console.log(`📊 마이그레이션 대상: ${legacyInspections.length}개 점검 기록\n`);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    // 2. inspection_assignments 생성
    for (const inspection of legacyInspections) {
      try {
        // 이미 존재하는지 확인
        const existing = await prisma.inspection_assignments.findFirst({
          where: {
            equipment_serial: inspection.equipment_serial,
            assigned_to: inspection.inspector_id,
            completed_at: inspection.completed_at
          }
        });

        if (existing) {
          skipped++;
          continue;
        }

        // 새로운 assignment 생성
        await prisma.inspection_assignments.create({
          data: {
            equipment_serial: inspection.equipment_serial,
            assigned_to: inspection.inspector_id,
            assigned_by: inspection.inspector_id,
            assignment_type: 'completed',
            status: 'completed',
            priority_level: 1,
            notes: `레거시 점검 데이터 마이그레이션 (inspection_id: ${inspection.id})`,
            started_at: inspection.inspection_date,
            completed_at: inspection.completed_at || inspection.inspection_date,
            created_at: inspection.created_at || inspection.inspection_date
          }
        });

        created++;

        // 진행 상황 표시 (100개마다)
        if ((created + skipped) % 100 === 0) {
          console.log(`   진행중... ${created + skipped}/${legacyInspections.length}`);
        }
      } catch (error) {
        failed++;
        console.error(`   ❌ 마이그레이션 실패 (inspection_id: ${inspection.id}):`, error);
      }
    }

    console.log('\n📊 마이그레이션 결과:');
    console.log(`   ✅ 생성: ${created}개`);
    console.log(`   ⏭️ 건너뜀 (중복): ${skipped}개`);
    console.log(`   ❌ 실패: ${failed}개`);
    console.log(`   📋 전체: ${legacyInspections.length}개`);

    // 3. 통계 확인
    const totalAssignments = await prisma.inspection_assignments.count({
      where: {
        status: 'completed'
      }
    });

    console.log(`\n📈 전체 완료된 할당: ${totalAssignments}개`);

  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
migrateLegacyInspections()
  .then(() => {
    console.log('\n✅ 마이그레이션 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 예상치 못한 오류:', error);
    process.exit(1);
  });