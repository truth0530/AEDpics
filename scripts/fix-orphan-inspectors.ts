#!/usr/bin/env npx tsx
/**
 * local_admin이 없는 보건소 임시점검원 장비 할당
 *
 * 문제: 4개 보건소에 local_admin이 없어서 임시점검원에게 장비 할당 불가
 * 해결: 시스템 관리자 권한으로 대리 할당
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function fixOrphanInspectors() {
  try {
    console.log('🔧 local_admin 없는 보건소 임시점검원 처리\n');

    // 시스템 관리자 찾기 (중앙응급의료센터)
    const systemAdmin = await prisma.user_profiles.findFirst({
      where: {
        role: 'master',
        is_active: true
      },
      select: {
        id: true,
        full_name: true,
        email: true
      }
    });

    if (!systemAdmin) {
      console.error('❌ 시스템 관리자를 찾을 수 없습니다.');
      return;
    }

    console.log(`📋 시스템 관리자: ${systemAdmin.full_name} (${systemAdmin.email})`);
    console.log('   대리 할당을 시작합니다.\n');

    // local_admin이 없는 임시점검원 목록
    const orphanInspectors = [
      { email: 'aeri6@naver.com', name: '김시하', org: '충청북도 충주시 보건소', region: '충북', district: '충주시' },
      { email: 'db931210@gmail.com', name: '유미경', org: '충청남도 계룡시 보건소', region: '충남', district: '계룡시' },
      { email: 'mentalchange@naver.com', name: '안은규', org: '경산시 보건소', region: '경북', district: '경산시' },
      { email: 'fall0788@naver.com', name: '김강수', org: '부산광역시 북구 보건소', region: '부산', district: '북구' }
    ];

    for (const orphan of orphanInspectors) {
      console.log(`\n👤 처리 중: ${orphan.name} (${orphan.org})`);

      // 사용자 조회
      const user = await prisma.user_profiles.findFirst({
        where: { email: orphan.email }
      });

      if (!user) {
        console.log(`   ❌ 사용자를 찾을 수 없습니다.`);
        continue;
      }

      // 해당 지역 AED 장비 조회
      const aedDevices = await prisma.aed_data.findMany({
        where: {
          sido: orphan.region,
          gugun: orphan.district
        },
        select: {
          equipment_serial: true,
          installation_institution: true
        },
        take: 30 // 적당한 개수만 할당
      });

      console.log(`   📍 발견된 AED 장비: ${aedDevices.length}개`);

      if (aedDevices.length === 0) {
        console.log(`   ⚠️ 해당 지역에 AED 장비가 없습니다.`);
        continue;
      }

      // 기존 할당 확인
      const existingCount = await prisma.inspection_assignments.count({
        where: {
          assigned_to: user.id,
          status: { in: ['pending', 'in_progress'] }
        }
      });

      if (existingCount > 0) {
        console.log(`   ℹ️ 이미 ${existingCount}개 할당되어 있습니다. (건너뜀)`);
        continue;
      }

      // inspection_assignments 생성
      const assignmentsToCreate = aedDevices.map(device => ({
        equipment_serial: device.equipment_serial,
        assigned_to: user.id,
        assigned_by: systemAdmin.id, // 시스템 관리자가 대리 할당
        assignment_type: 'scheduled' as const,
        priority_level: 1,
        status: 'pending' as const,
        notes: 'local_admin 부재로 시스템 관리자 대리 할당'
      }));

      const result = await prisma.inspection_assignments.createMany({
        data: assignmentsToCreate,
        skipDuplicates: true
      });

      console.log(`   ✅ ${result.count}개 장비 할당 완료`);

      // team_members에도 추가
      const existingTeamMember = await prisma.team_members.findFirst({
        where: {
          user_profile_id: user.id,
          organization_id: user.organization_id
        }
      });

      if (!existingTeamMember) {
        await prisma.team_members.create({
          data: {
            id: randomUUID(),
            organization_id: user.organization_id,
            name: user.full_name,
            email: user.email,
            member_type: 'temporary',
            user_profile_id: user.id,
            added_by: systemAdmin.id,
            is_active: true
          }
        });
        console.log(`   ✅ 팀원으로 등록 완료`);
      }
    }

    console.log('\n✨ 모든 orphan 임시점검원 처리 완료!');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
fixOrphanInspectors()
  .catch(console.error)
  .finally(() => process.exit());