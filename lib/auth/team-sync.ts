/**
 * Team Members 동기화 유틸리티
 *
 * 문제: team_members 테이블이 비어있어서 팀원 관리가 불가능
 * 해결: 사용자가 조직에 속하면 자동으로 team_members에 추가
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

/**
 * 사용자를 team_members 테이블에 자동 추가
 *
 * @param userId - 사용자 ID
 * @param organizationId - 조직 ID
 * @param userEmail - 사용자 이메일
 * @param userName - 사용자 이름
 * @param memberType - 멤버 타입
 * @param addedBy - 추가한 사람 ID
 */
export async function syncUserToTeam(
  userId: string,
  organizationId: string,
  userEmail: string,
  userName: string,
  memberType: 'permanent' | 'temporary' = 'permanent',
  addedBy: string
) {
  try {
    // team_members에 생성 또는 업데이트
    // user_profile_id와 organization_id 조합으로 확인
    const existing = await prisma.team_members.findFirst({
      where: {
        user_profile_id: userId,
        organization_id: organizationId
      }
    });

    if (existing) {
      const teamMember = await prisma.team_members.update({
        where: { id: existing.id },
        data: {
          member_type: memberType,
          is_active: true,
          updated_at: new Date()
        }
      });
      console.log(`✅ Team member updated: ${userName} in organization ${organizationId}`);
      return teamMember;
    } else {
      const teamMember = await prisma.team_members.create({
        data: {
          id: randomUUID(),
          organization_id: organizationId,
          name: userName,
          email: userEmail,
          member_type: memberType,
          user_profile_id: userId,
          added_by: addedBy,
          is_active: true,
          created_at: new Date()
        }
      });
      console.log(`✅ Team member created: ${userName} in organization ${organizationId}`);
      return teamMember;
    }
  } catch (error) {
    console.error('❌ Team sync failed:', error);
    throw error;
  }
}

/**
 * 조직의 모든 사용자를 team_members와 동기화
 *
 * @param organizationId - 조직 ID
 * @param addedBy - 추가한 사람 ID (시스템 관리자 또는 local_admin)
 */
export async function syncOrganizationTeamMembers(organizationId: string, addedBy?: string) {
  try {
    // 해당 조직의 모든 활성 사용자 조회
    const users = await prisma.user_profiles.findMany({
      where: {
        organization_id: organizationId,
        is_active: true
      }
    });

    console.log(`🔄 Syncing ${users.length} users for organization ${organizationId}`);

    // addedBy가 없으면 첫 번째 local_admin 사용
    if (!addedBy) {
      const localAdmin = users.find(u => u.role === 'local_admin');
      addedBy = localAdmin?.id || users[0]?.id || 'system';
    }

    // 각 사용자를 team_members에 추가
    for (const user of users) {
      // temporary_inspector는 temporary, 나머지는 permanent
      const memberType = user.role === 'temporary_inspector' ? 'temporary' : 'permanent';

      await syncUserToTeam(
        user.id,
        organizationId,
        user.email,
        user.full_name,
        memberType,
        addedBy
      );
    }

    console.log(`✅ Organization sync complete: ${users.length} members added`);
    return users.length;
  } catch (error) {
    console.error('❌ Organization sync failed:', error);
    throw error;
  }
}

/**
 * 모든 조직의 team_members를 동기화 (초기 설정용)
 */
export async function syncAllTeamMembers() {
  try {
    // 모든 조직 조회
    const organizations = await prisma.organizations.findMany({
      where: {
        type: 'health_center'
      }
    });

    console.log(`🚀 Starting sync for ${organizations.length} organizations`);

    let totalSynced = 0;
    for (const org of organizations) {
      // 각 조직의 첫 번째 local_admin을 addedBy로 사용
      const localAdmin = await prisma.user_profiles.findFirst({
        where: {
          organization_id: org.id,
          role: 'local_admin',
          is_active: true
        }
      });
      const count = await syncOrganizationTeamMembers(org.id, localAdmin?.id);
      totalSynced += count;
    }

    console.log(`✅ Total sync complete: ${totalSynced} team members created`);
    return totalSynced;
  } catch (error) {
    console.error('❌ Full sync failed:', error);
    throw error;
  }
}