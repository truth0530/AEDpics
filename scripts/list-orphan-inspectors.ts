#!/usr/bin/env npx tsx
/**
 * 담당자 없는 조직에 속한 임시점검원 상세 조회
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// 환경변수 로드 (DATABASE_URL이 이미 설정되면 .env.local 무시)
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

const prisma = new PrismaClient();

async function listOrphanInspectors() {
  try {
    console.log('📋 담당자 없는 조직 소속 임시점검원 조회\n');

    // 4명의 특정 임시점검원 조회
    const orphanInspectors = await prisma.user_profiles.findMany({
      where: {
        role: 'temporary_inspector',
        email: {
          in: ['aeri6@naver.com', 'db931210@gmail.com', 'mentalchange@naver.com', 'fall0788@naver.com']
        }
      },
      include: {
        organizations: true
      }
    });

    if (orphanInspectors.length === 0) {
      console.log('해당 임시점검원을 찾을 수 없습니다.');
      return;
    }

    console.log(`총 ${orphanInspectors.length}명 발견\n`);

    for (let i = 0; i < orphanInspectors.length; i++) {
      const inspector = orphanInspectors[i];
      const org = inspector.organizations;

      // 할당된 장비 조회
      const assignmentCount = await prisma.inspection_assignments.count({
        where: {
          assigned_to: inspector.id,
          status: { in: ['pending', 'in_progress'] }
        }
      });

      console.log(`${i + 1}. ${inspector.full_name}`);
      console.log(`   이메일: ${inspector.email}`);
      console.log(`   지역: ${inspector.region} ${inspector.district || ''}`);
      console.log(`   현재 조직: ${org?.name || inspector.organization_name || '없음'}`);
      console.log(`   조직 ID: ${inspector.organization_id}`);

      if (org) {
        // 현재 조직의 local_admin 확인
        const localAdmins = await prisma.user_profiles.findMany({
          where: {
            organization_id: org.id,
            role: 'local_admin',
            is_active: true
          },
          select: {
            id: true,
            full_name: true,
            email: true
          }
        });

        console.log(`   담당자: ${localAdmins.length > 0 ? '있음' : '❌ 없음'}`);
        if (localAdmins.length > 0) {
          localAdmins.forEach(admin => {
            console.log(`      - ${admin.full_name} (${admin.email})`);
          });
        }
      }

      console.log(`   할당 장비: ${assignmentCount}개`);
      console.log('');
    }

    // 해당 지역의 담당자 있는 조직 추천
    console.log('\n🔍 재할당 가능한 조직 추천\n');

    for (const inspector of orphanInspectors) {
      if (!inspector.region) continue;

      const recommendedOrgs = await prisma.organizations.findMany({
        where: {
          region_code: inspector.region,
          type: 'health_center',
          user_profiles: {
            some: {
              role: 'local_admin',
              is_active: true
            }
          }
        },
        include: {
          _count: {
            select: {
              user_profiles: {
                where: {
                  role: 'local_admin',
                  is_active: true
                }
              }
            }
          }
        },
        take: 3
      });

      console.log(`${inspector.full_name} (${inspector.region})`);
      if (recommendedOrgs.length > 0) {
        recommendedOrgs.forEach((org, idx) => {
          console.log(`   ${idx + 1}. ${org.name} [담당자: ${org._count.user_profiles}명]`);
        });
      } else {
        console.log('   ⚠️ 해당 지역에 담당자가 있는 조직이 없습니다');
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
listOrphanInspectors()
  .catch(console.error)
  .finally(() => process.exit());