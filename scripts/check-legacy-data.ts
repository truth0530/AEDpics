#!/usr/bin/env npx tsx
/**
 * 레거시 점검 데이터 확인 스크립트
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// 환경변수 로드 (DATABASE_URL이 이미 설정되면 .env.local 무시)
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

const prisma = new PrismaClient();

async function checkLegacyData() {
  try {
    console.log('🔍 레거시 점검 데이터 분석:\n');

    // 최근 3개월 점검 중 assignments 없는 데이터 확인
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const legacyInspections = await prisma.inspections.findMany({
      where: {
        inspection_date: {
          gte: threeMonthsAgo
        }
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

    console.log(`3개월 내 총 점검: ${legacyInspections.length}건`);

    // assignments 테이블과 대조
    let unmatchedCount = 0;
    const unmatched = [];

    for (const inspection of legacyInspections) {
      const assignment = await prisma.inspection_assignments.findFirst({
        where: {
          equipment_serial: inspection.equipment_serial,
          assigned_to: inspection.inspector_id,
          status: 'completed'
        }
      });

      if (!assignment) {
        unmatchedCount++;
        unmatched.push(inspection);

        // 날짜 계산
        const ageInDays = Math.floor((Date.now() - new Date(inspection.inspection_date).getTime()) / (1000 * 60 * 60 * 24));

        console.log(`❌ ID: ${inspection.id.slice(0, 8)}...`);
        console.log(`   점검일: ${new Date(inspection.inspection_date).toLocaleDateString('ko-KR')} (${ageInDays}일 전)`);
        console.log(`   점검자: ${inspection.user_profiles?.full_name || 'Unknown'} (${inspection.user_profiles?.email})`);
        console.log(`   조직: ${inspection.user_profiles?.organization_name || 'Unknown'}`);
        console.log(`   장비: ${inspection.equipment_serial}`);
        console.log(`   완료일: ${inspection.completed_at ? new Date(inspection.completed_at).toLocaleDateString('ko-KR') : '미완료'}`);
        console.log('');
      }
    }

    console.log(`\n미매칭 점검: ${unmatchedCount}건`);

    // 6개월 이상 오래된 점검 확인
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const veryOldInspections = await prisma.inspections.count({
      where: {
        inspection_date: {
          lt: sixMonthsAgo
        }
      }
    });

    console.log(`\n📅 6개월 이상 오래된 점검: ${veryOldInspections}건 (마이그레이션 대상 제외)`);

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
checkLegacyData()
  .catch(console.error)
  .finally(() => process.exit());