#!/usr/bin/env npx tsx
/**
 * 점검 시스템 모니터링 스크립트
 *
 * 목적: 점검 시스템의 현재 상태를 진단하고 문제점을 보고
 * 실행: npm run monitor:inspection-system
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// 환경변수 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// 색상 코드 (터미널 출력용)
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

interface SystemIssue {
  level: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  action?: string;
  data?: any;
}

async function monitorInspectionSystem() {
  console.log(`\n${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.cyan}     점검 시스템 모니터링 보고서${colors.reset}`);
  console.log(`${colors.cyan}     ${new Date().toLocaleString('ko-KR')}${colors.reset}`);
  console.log(`${colors.cyan}========================================${colors.reset}\n`);

  const issues: SystemIssue[] = [];

  try {
    // 1. 시스템 통계
    console.log(`${colors.blue}📊 시스템 통계${colors.reset}`);
    console.log(`${colors.white}----------------------------------------${colors.reset}`);

    const totalUsers = await prisma.user_profiles.count();
    const activeUsers = await prisma.user_profiles.count({ where: { is_active: true } });
    const temporaryInspectors = await prisma.user_profiles.count({
      where: { role: 'temporary_inspector', is_active: true }
    });
    const totalDevices = await prisma.aed_data.count();
    const totalAssignments = await prisma.inspection_assignments.count();
    const pendingAssignments = await prisma.inspection_assignments.count({
      where: { status: 'pending' }
    });
    const totalInspections = await prisma.inspections.count();

    console.log(`  전체 사용자: ${totalUsers}명`);
    console.log(`  활성 사용자: ${activeUsers}명`);
    console.log(`  임시점검원: ${temporaryInspectors}명`);
    console.log(`  AED 장비: ${totalDevices.toLocaleString()}대`);
    console.log(`  전체 할당: ${totalAssignments}건`);
    console.log(`  대기중 할당: ${pendingAssignments}건`);
    console.log(`  완료된 점검: ${totalInspections}건\n`);

    // 2. 임시점검원 상태 체크
    console.log(`${colors.blue}👤 임시점검원 상태 점검${colors.reset}`);
    console.log(`${colors.white}----------------------------------------${colors.reset}`);

    const tempInspectorsDetail = await prisma.user_profiles.findMany({
      where: {
        role: 'temporary_inspector',
        is_active: true
      },
      include: {
        inspection_assignments_inspection_assignments_assigned_toTouser_profiles: {
          where: { status: { in: ['pending', 'in_progress'] } }
        }
      }
    });

    let unassignedInspectorCount = 0;
    for (const inspector of tempInspectorsDetail) {
      const assignmentCount = inspector.inspection_assignments_inspection_assignments_assigned_toTouser_profiles.length;

      if (assignmentCount === 0) {
        unassignedInspectorCount++;
        console.log(`  ⚠️ ${colors.yellow}${inspector.full_name} (${inspector.email}): 할당된 장비 없음${colors.reset}`);
      } else {
        console.log(`  ✅ ${inspector.full_name}: ${assignmentCount}개 장비 할당됨`);
      }
    }

    if (unassignedInspectorCount > 0) {
      issues.push({
        level: 'critical',
        category: '임시점검원',
        message: `${unassignedInspectorCount}명의 임시점검원이 장비를 할당받지 못했습니다`,
        action: 'npm run emergency:assign-inspectors'
      });
    }

    // 3. Team Members 상태 체크
    console.log(`\n${colors.blue}👥 팀 멤버 상태 점검${colors.reset}`);
    console.log(`${colors.white}----------------------------------------${colors.reset}`);

    const organizations = await prisma.organizations.findMany({
      where: { type: 'health_center' },
      include: {
        team_members: true,
        user_profiles: { where: { is_active: true } }
      }
    });

    let emptyTeamCount = 0;
    let mismatchedTeamCount = 0;

    for (const org of organizations) {
      const activeUserCount = org.user_profiles.length;
      const teamMemberCount = org.team_members.length;

      if (activeUserCount > 0 && teamMemberCount === 0) {
        emptyTeamCount++;
        console.log(`  ⚠️ ${colors.yellow}${org.name}: 활성 사용자 ${activeUserCount}명, 팀 멤버 0명${colors.reset}`);
      } else if (activeUserCount !== teamMemberCount) {
        mismatchedTeamCount++;
        console.log(`  ⚠️ ${colors.yellow}${org.name}: 활성 사용자 ${activeUserCount}명, 팀 멤버 ${teamMemberCount}명 (불일치)${colors.reset}`);
      }
    }

    if (emptyTeamCount > 0) {
      issues.push({
        level: 'warning',
        category: '팀 관리',
        message: `${emptyTeamCount}개 조직의 팀 멤버가 비어있습니다`,
        action: 'npm run sync:team-members'
      });
    }

    if (mismatchedTeamCount > 0) {
      issues.push({
        level: 'warning',
        category: '팀 관리',
        message: `${mismatchedTeamCount}개 조직의 사용자와 팀 멤버 수가 일치하지 않습니다`,
        action: '수동 검토 필요'
      });
    }

    // 4. 레거시 데이터 체크
    console.log(`\n${colors.blue}📦 레거시 데이터 점검${colors.reset}`);
    console.log(`${colors.white}----------------------------------------${colors.reset}`);

    // 최근 3개월 점검 중 assignment가 없는 것 체크
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentInspections = await prisma.inspections.findMany({
      where: {
        inspection_date: { gte: threeMonthsAgo }
      }
    });

    let unmatchedInspectionCount = 0;
    for (const inspection of recentInspections) {
      const assignment = await prisma.inspection_assignments.findFirst({
        where: {
          equipment_serial: inspection.equipment_serial,
          assigned_to: inspection.inspector_id,
          status: 'completed'
        }
      });

      if (!assignment) {
        unmatchedInspectionCount++;
      }
    }

    if (unmatchedInspectionCount > 0) {
      console.log(`  ⚠️ ${colors.yellow}최근 3개월 점검 중 ${unmatchedInspectionCount}건이 assignment 테이블에 없습니다${colors.reset}`);
      issues.push({
        level: 'warning',
        category: '데이터 일관성',
        message: `${unmatchedInspectionCount}건의 점검이 assignment와 매칭되지 않습니다`,
        action: 'npm run migrate:legacy-inspections'
      });
    } else {
      console.log(`  ✅ 모든 최근 점검이 assignment와 매칭됩니다`);
    }

    // 5. 지역 권한 일관성 체크
    console.log(`\n${colors.blue}🗺️ 지역 권한 일관성 점검${colors.reset}`);
    console.log(`${colors.white}----------------------------------------${colors.reset}`);

    const usersWithRegion = await prisma.user_profiles.findMany({
      where: {
        is_active: true,
        role: { in: ['local_admin', 'temporary_inspector'] }
      },
      select: {
        id: true,
        full_name: true,
        region: true,
        district: true,
        region_code: true,
        organizations: {
          select: {
            name: true,
            region_code: true,
            city_code: true
          }
        }
      }
    });

    let regionMismatchCount = 0;
    for (const user of usersWithRegion) {
      if (user.organizations && user.region_code !== user.organizations.region_code) {
        regionMismatchCount++;
        console.log(`  ⚠️ ${colors.yellow}${user.full_name}: 사용자 지역(${user.region_code}) ≠ 조직 지역(${user.organizations.region_code})${colors.reset}`);
      }
    }

    if (regionMismatchCount > 0) {
      issues.push({
        level: 'warning',
        category: '지역 권한',
        message: `${regionMismatchCount}명의 사용자 지역 코드가 조직과 일치하지 않습니다`,
        action: 'npm run normalize:region-codes'
      });
    }

    // 6. 최근 에러 패턴 분석 (로그 파일이 있다면)
    console.log(`\n${colors.blue}⚠️ 최근 문제 패턴${colors.reset}`);
    console.log(`${colors.white}----------------------------------------${colors.reset}`);

    // 최근 24시간 내 생성된 중복 assignment 체크
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentDuplicates = await prisma.$queryRaw<{equipment_serial: string, assigned_to: string, count: bigint}[]>`
      SELECT equipment_serial, assigned_to, COUNT(*) as count
      FROM inspection_assignments
      WHERE created_at >= ${oneDayAgo}
      GROUP BY equipment_serial, assigned_to
      HAVING COUNT(*) > 1
    `;

    const duplicateCount = recentDuplicates.length;
    if (duplicateCount > 0) {
      console.log(`  ⚠️ ${colors.yellow}최근 24시간 내 ${duplicateCount}건의 중복 할당 발생${colors.reset}`);
      issues.push({
        level: 'warning',
        category: '중복 데이터',
        message: `최근 24시간 내 ${duplicateCount}건의 중복 할당이 발생했습니다`,
        action: '409 에러 처리 로직 점검 필요'
      });
    }

    // 7. 권고사항 요약
    console.log(`\n${colors.blue}📋 문제점 요약 및 권고사항${colors.reset}`);
    console.log(`${colors.white}========================================${colors.reset}`);

    if (issues.length === 0) {
      console.log(`${colors.green}✅ 시스템이 정상적으로 작동하고 있습니다!${colors.reset}\n`);
    } else {
      const criticalIssues = issues.filter(i => i.level === 'critical');
      const warningIssues = issues.filter(i => i.level === 'warning');
      const infoIssues = issues.filter(i => i.level === 'info');

      if (criticalIssues.length > 0) {
        console.log(`\n${colors.red}🚨 치명적 문제 (${criticalIssues.length}건)${colors.reset}`);
        for (const issue of criticalIssues) {
          console.log(`  • [${issue.category}] ${issue.message}`);
          if (issue.action) {
            console.log(`    → 해결: ${colors.cyan}${issue.action}${colors.reset}`);
          }
        }
      }

      if (warningIssues.length > 0) {
        console.log(`\n${colors.yellow}⚠️ 경고 사항 (${warningIssues.length}건)${colors.reset}`);
        for (const issue of warningIssues) {
          console.log(`  • [${issue.category}] ${issue.message}`);
          if (issue.action) {
            console.log(`    → 권장: ${colors.cyan}${issue.action}${colors.reset}`);
          }
        }
      }

      if (infoIssues.length > 0) {
        console.log(`\n${colors.blue}ℹ️ 정보 (${infoIssues.length}건)${colors.reset}`);
        for (const issue of infoIssues) {
          console.log(`  • [${issue.category}] ${issue.message}`);
        }
      }
    }

    // 8. 실행 가능한 명령어 목록
    console.log(`\n${colors.blue}🛠️ 사용 가능한 복구 명령어${colors.reset}`);
    console.log(`${colors.white}----------------------------------------${colors.reset}`);
    console.log('  • npm run emergency:assign-inspectors  - 임시점검원 긴급 장비 할당');
    console.log('  • npm run sync:team-members            - 팀 멤버 동기화');
    console.log('  • npm run migrate:legacy-inspections   - 레거시 점검 데이터 마이그레이션');
    console.log('  • npm run normalize:region-codes       - 지역 코드 정규화');
    console.log('  • npm run monitor:inspection-system    - 이 모니터링 보고서 재실행');

    console.log(`\n${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.cyan}          모니터링 완료${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}\n`);

  } catch (error) {
    console.error(`${colors.red}❌ 모니터링 중 오류 발생:${colors.reset}`, error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
monitorInspectionSystem()
  .catch(console.error)
  .finally(() => process.exit());