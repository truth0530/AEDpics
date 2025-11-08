#!/usr/bin/env npx tsx
/**
 * 긴급 스크립트: 임시점검원에게 장비 할당
 *
 * 문제: 임시점검원이 inspection_assignments가 없어서 장비를 볼 수 없음
 * 해결: 해당 보건소의 장비를 임시점검원에게 자동 할당
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';

// 환경변수 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function assignDevicesToTemporaryInspectors() {
  try {
    console.log('🚀 임시점검원 장비 할당 시작...\n');

    // 1. 모든 임시점검원 조회
    const temporaryInspectors = await prisma.user_profiles.findMany({
      where: {
        role: 'temporary_inspector',
        is_active: true
      },
      include: {
        organizations: true
      }
    });

    console.log(`📋 활성 임시점검원: ${temporaryInspectors.length}명\n`);

    for (const inspector of temporaryInspectors) {
      console.log(`\n👤 처리 중: ${inspector.full_name} (${inspector.email})`);
      console.log(`   조직: ${inspector.organization_name}`);
      console.log(`   지역: ${inspector.region} ${inspector.district}`);

      // 2. 해당 지역의 보건소 담당자 찾기
      const localAdmin = await prisma.user_profiles.findFirst({
        where: {
          role: 'local_admin',
          organization_id: inspector.organization_id,
          is_active: true
        }
      });

      if (!localAdmin) {
        console.log(`   ⚠️ 보건소 담당자를 찾을 수 없습니다.`);
        continue;
      }

      // 3. 해당 지역(중구)의 AED 장비 조회
      // 지역명 매핑 (full name -> abbreviated)
      const regionMapping: Record<string, string> = {
        '서울특별시': '서울',
        '부산광역시': '부산',
        '대구광역시': '대구',
        '인천광역시': '인천',
        '광주광역시': '광주',
        '대전광역시': '대전',
        '울산광역시': '울산',
        '세종특별자치시': '세종',
        '경기도': '경기',
        '강원도': '강원',
        '강원특별자치도': '강원',
        '충청북도': '충북',
        '충청남도': '충남',
        '전라북도': '전북',
        '전북특별자치도': '전북',
        '전라남도': '전남',
        '경상북도': '경북',
        '경상남도': '경남',
        '제주특별자치도': '제주'
      };

      const mappedRegion = regionMapping[inspector.region || ''] || inspector.region;

      const aedDevices = await prisma.aed_data.findMany({
        where: {
          sido: mappedRegion || undefined,
          gugun: inspector.district || undefined
        },
        select: {
          equipment_serial: true,
          installation_institution: true
        },
        take: 50 // 일단 50개만 할당 (너무 많으면 부담)
      });

      console.log(`   📍 발견된 AED 장비: ${aedDevices.length}개`);

      // 4. 기존 할당 확인
      const existingAssignments = await prisma.inspection_assignments.count({
        where: {
          assigned_to: inspector.id,
          status: { in: ['pending', 'in_progress'] }
        }
      });

      if (existingAssignments > 0) {
        console.log(`   ✅ 이미 ${existingAssignments}개 할당됨 (건너뜀)`);
        continue;
      }

      // 5. inspection_assignments 생성
      const assignmentsToCreate = aedDevices.map(device => ({
        equipment_serial: device.equipment_serial,
        assigned_to: inspector.id,
        assigned_by: localAdmin.id, // 보건소 담당자가 할당한 것으로 기록
        assignment_type: 'scheduled' as const,
        priority_level: 1,
        status: 'pending' as const,
        notes: '시스템 자동 할당 (레거시 마이그레이션)'
      }));

      const result = await prisma.inspection_assignments.createMany({
        data: assignmentsToCreate,
        skipDuplicates: true
      });

      console.log(`   ✅ ${result.count}개 장비 할당 완료`);

      // 6. team_members에도 추가 (팀원으로 등록)
      const existingTeamMember = await prisma.team_members.findFirst({
        where: {
          user_profile_id: inspector.id,
          organization_id: inspector.organization_id
        }
      });

      if (!existingTeamMember) {
        await prisma.team_members.create({
          data: {
            id: randomUUID(),
            organization_id: inspector.organization_id,
            name: inspector.full_name,
            email: inspector.email,
            member_type: 'temporary',
            user_profile_id: inspector.id,
            added_by: localAdmin.id,
            is_active: true
          }
        });
        console.log(`   ✅ 팀원으로 등록 완료`);
      } else {
        console.log(`   ℹ️ 이미 팀원으로 등록됨`);
      }
    }

    console.log('\n✨ 모든 임시점검원 처리 완료!');

    // 최종 통계
    const totalAssignments = await prisma.inspection_assignments.count({
      where: {
        status: 'pending'
      }
    });
    console.log(`\n📊 전체 대기중인 할당: ${totalAssignments}개`);

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
assignDevicesToTemporaryInspectors()
  .catch(console.error)
  .finally(() => process.exit());