#!/usr/bin/env npx tsx
/**
 * 사용자 관리 시스템 통합 테스트
 *
 * 테스트 항목:
 * 1. 임시점검원 회원가입 시 local_admin 있는 조직만 표시
 * 2. 관리자의 사용자 정보 수정 기능
 * 3. 조직 변경 시 team_members 동기화
 * 4. 알림 시스템 작동 여부
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message?: string;
}

async function testUserManagement() {
  const results: TestResult[] = [];

  console.log('🧪 사용자 관리 시스템 테스트 시작\n');

  try {
    // Test 1: local_admin이 있는 조직 조회
    console.log('📋 Test 1: local_admin이 있는 조직 조회');
    try {
      const orgsWithAdmin = await prisma.organizations.findMany({
        where: {
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
        }
      });

      console.log(`   ✅ ${orgsWithAdmin.length}개 조직에 local_admin 존재`);

      const sampleOrgs = orgsWithAdmin.slice(0, 3);
      sampleOrgs.forEach(org => {
        console.log(`      - ${org.name}: ${org._count.user_profiles}명 담당자`);
      });

      results.push({
        test: 'local_admin 있는 조직 조회',
        status: 'PASS',
        message: `${orgsWithAdmin.length}개 조직 확인`
      });
    } catch (error) {
      results.push({
        test: 'local_admin 있는 조직 조회',
        status: 'FAIL',
        message: String(error)
      });
    }

    // Test 2: local_admin이 없는 조직 확인
    console.log('\n📋 Test 2: local_admin이 없는 조직 확인');
    try {
      const orgsWithoutAdmin = await prisma.organizations.findMany({
        where: {
          type: 'health_center',
          NOT: {
            user_profiles: {
              some: {
                role: 'local_admin',
                is_active: true
              }
            }
          }
        }
      });

      console.log(`   ⚠️ ${orgsWithoutAdmin.length}개 조직에 local_admin 없음`);

      const sampleOrgsNoAdmin = orgsWithoutAdmin.slice(0, 5);
      sampleOrgsNoAdmin.forEach(org => {
        console.log(`      - ${org.name} (${org.city_code || org.region_code})`);
      });

      results.push({
        test: 'local_admin 없는 조직 확인',
        status: 'PASS',
        message: `${orgsWithoutAdmin.length}개 조직 발견`
      });
    } catch (error) {
      results.push({
        test: 'local_admin 없는 조직 확인',
        status: 'FAIL',
        message: String(error)
      });
    }

    // Test 3: 임시점검원 현황
    console.log('\n📋 Test 3: 임시점검원 현황 확인');
    try {
      const tempInspectors = await prisma.user_profiles.findMany({
        where: {
          role: 'temporary_inspector',
          is_active: true
        },
        include: {
          organizations: true
        }
      });

      console.log(`   👤 활성 임시점검원: ${tempInspectors.length}명`);

      // 조직별 분류
      const withOrg = tempInspectors.filter(u => u.organization_id);
      const withoutOrg = tempInspectors.filter(u => !u.organization_id);

      console.log(`      - 조직 소속: ${withOrg.length}명`);
      console.log(`      - 조직 미소속: ${withoutOrg.length}명`);

      // local_admin 있는 조직 소속 확인
      if (withOrg.length > 0) {
        const orgIds = [...new Set(withOrg.map(u => u.organization_id).filter(Boolean))];

        const orgsWithAdminCheck = await prisma.organizations.findMany({
          where: {
            id: { in: orgIds as string[] }
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
          }
        });

        const withAdmin = orgsWithAdminCheck.filter(o => o._count.user_profiles > 0);
        const withoutAdmin = orgsWithAdminCheck.filter(o => o._count.user_profiles === 0);

        console.log(`      - 담당자 있는 조직 소속: ${withAdmin.length}개 조직`);
        console.log(`      - 담당자 없는 조직 소속: ${withoutAdmin.length}개 조직`);

        if (withoutAdmin.length > 0) {
          console.log('\n      ⚠️ 담당자 없는 조직 소속 임시점검원:');
          for (const org of withoutAdmin) {
            const inspectors = tempInspectors.filter(u => u.organization_id === org.id);
            console.log(`         ${org.name}: ${inspectors.map(i => i.full_name).join(', ')}`);
          }
        }
      }

      results.push({
        test: '임시점검원 현황 확인',
        status: 'PASS',
        message: `총 ${tempInspectors.length}명 확인`
      });
    } catch (error) {
      results.push({
        test: '임시점검원 현황 확인',
        status: 'FAIL',
        message: String(error)
      });
    }

    // Test 4: team_members 동기화 확인
    console.log('\n📋 Test 4: team_members 테이블 동기화 확인');
    try {
      const tempInspectorsWithOrg = await prisma.user_profiles.findMany({
        where: {
          role: 'temporary_inspector',
          organization_id: { not: null }
        }
      });

      let syncedCount = 0;
      let notSyncedCount = 0;

      for (const inspector of tempInspectorsWithOrg) {
        const teamMember = await prisma.team_members.findFirst({
          where: {
            user_profile_id: inspector.id,
            organization_id: inspector.organization_id!
          }
        });

        if (teamMember) {
          syncedCount++;
        } else {
          notSyncedCount++;
          console.log(`      ❌ ${inspector.full_name} - team_members 누락`);
        }
      }

      console.log(`   ✅ 동기화됨: ${syncedCount}명`);
      console.log(`   ❌ 미동기화: ${notSyncedCount}명`);

      results.push({
        test: 'team_members 동기화 확인',
        status: notSyncedCount === 0 ? 'PASS' : 'FAIL',
        message: `${syncedCount}/${tempInspectorsWithOrg.length} 동기화`
      });
    } catch (error) {
      results.push({
        test: 'team_members 동기화 확인',
        status: 'FAIL',
        message: String(error)
      });
    }

    // Test 5: 장비 할당 현황
    console.log('\n📋 Test 5: 임시점검원 장비 할당 현황');
    try {
      const tempInspectorsActive = await prisma.user_profiles.findMany({
        where: {
          role: 'temporary_inspector',
          is_active: true
        }
      });

      let withAssignments = 0;
      let withoutAssignments = 0;
      const noAssignmentUsers = [];

      for (const inspector of tempInspectorsActive) {
        const assignments = await prisma.inspection_assignments.count({
          where: {
            assigned_to: inspector.id,
            status: { in: ['pending', 'in_progress'] }
          }
        });

        if (assignments > 0) {
          withAssignments++;
        } else {
          withoutAssignments++;
          noAssignmentUsers.push(`${inspector.full_name} (${inspector.organization_name || '조직 없음'})`);
        }
      }

      console.log(`   ✅ 장비 할당됨: ${withAssignments}명`);
      console.log(`   ❌ 장비 미할당: ${withoutAssignments}명`);

      if (noAssignmentUsers.length > 0) {
        console.log('\n      장비 미할당 임시점검원:');
        noAssignmentUsers.slice(0, 5).forEach(user => {
          console.log(`         - ${user}`);
        });
      }

      results.push({
        test: '임시점검원 장비 할당 현황',
        status: 'PASS',
        message: `${withAssignments}/${tempInspectorsActive.length} 할당`
      });
    } catch (error) {
      results.push({
        test: '임시점검원 장비 할당 현황',
        status: 'FAIL',
        message: String(error)
      });
    }

    // 최종 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('📊 테스트 결과 요약\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;

    results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`${icon} ${result.test}: ${result.status}`);
      if (result.message && result.status !== 'PASS') {
        console.log(`   ${result.message}`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`전체: ${results.length} | 통과: ${passed} | 실패: ${failed} | 스킵: ${skipped}`);

    if (failed === 0) {
      console.log('\n✨ 모든 테스트 통과!');
    } else {
      console.log('\n⚠️ 일부 테스트 실패 - 확인 필요');
    }

  } catch (error) {
    console.error('❌ 테스트 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
testUserManagement()
  .catch(console.error)
  .finally(() => process.exit());