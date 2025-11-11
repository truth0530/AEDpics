import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';
import {
  getTeamMemberFilter,
  buildTeamMemberSearchQuery,
  getOrganizationType,
  getEquipmentBasedTeamFilter,
} from '@/lib/utils/team-authorization';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. 현재 사용자 정보 조회
    const currentUser = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        full_name: true,
        email: true,
        role: true,
        region_code: true,
        district: true,
        organization_id: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 쿼리 파라미터 추출
    const searchUrl = new URL(request.url);
    const searchTerm = searchUrl.searchParams.get('search');
    const equipmentSerialsParam = searchUrl.searchParams.get('equipmentSerials');

    // 2. 권한 기반 팀원 필터 생성
    let memberFilter;

    // 장비 기반 필터링 (equipmentSerials 제공 시)
    if (equipmentSerialsParam && equipmentSerialsParam.trim().length > 0) {
      const equipmentSerials = equipmentSerialsParam.split(',').map(s => s.trim()).filter(Boolean);

      if (equipmentSerials.length > 0) {
        // 장비 위치 정보 조회 (첫 번째 장비 기준)
        const equipment = await prisma.aed_data.findUnique({
          where: { equipment_serial: equipmentSerials[0] },
          select: {
            sido: true,
            gugun: true,
          },
        });

        if (equipment && equipment.sido && equipment.gugun) {
          // 장비 기반 필터 사용
          memberFilter = getEquipmentBasedTeamFilter(
            { sido: equipment.sido, gugun: equipment.gugun },
            currentUser.id
          );
        } else {
          // 장비 위치를 찾을 수 없으면 기본 필터 사용
          memberFilter = getTeamMemberFilter(currentUser);
        }
      } else {
        memberFilter = getTeamMemberFilter(currentUser);
      }
    } else {
      // 기본 권한 기반 필터
      memberFilter = getTeamMemberFilter(currentUser);
    }

    // 3. 검색 쿼리 지원 (query 파라미터)
    if (searchTerm && searchTerm.trim().length > 0) {
      memberFilter = buildTeamMemberSearchQuery(searchTerm, memberFilter);
    }

    // 4. 팀원 목록 조회 (user_profiles 기반)
    // N+1 방지: COUNT aggregation으로 통계 함께 조회
    const members = await prisma.user_profiles.findMany({
      where: memberFilter,
      select: {
        id: true,
        full_name: true,
        email: true,
        phone: true,
        position: true,
        role: true,
        region_code: true,
        district: true,
      },
      orderBy: [
        { position: 'asc' },
        { full_name: 'asc' },
      ],
    });

    const memberIds = members.map((m) => m.id);

    // 5. 할당 통계 조회 (활성 과제: pending/in_progress)
    const assignmentCounts = await prisma.inspection_assignments.groupBy({
      by: ['assigned_to'],
      where: {
        assigned_to: { in: memberIds },
        status: { in: ['pending', 'in_progress'] },
      },
      _count: {
        id: true,
      },
    });

    const assignmentMap = new Map(
      assignmentCounts.map((a) => [a.assigned_to, a._count.id])
    );

    // 6. 완료 통계 (이번 달)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const completedCounts = await prisma.inspection_assignments.groupBy({
      by: ['assigned_to'],
      where: {
        assigned_to: { in: memberIds },
        status: 'completed',
        completed_at: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _count: {
        id: true,
      },
    });

    const completedMap = new Map(
      completedCounts.map((a) => [a.assigned_to, a._count.id])
    );

    // 7. 응답 데이터 구성
    const membersWithStats = members.map((member) => ({
      id: member.id,
      name: member.full_name,
      email: member.email,
      phone: member.phone,
      position: member.position,
      role: member.role,
      region_code: member.region_code,
      district: member.district,
      current_assigned: assignmentMap.get(member.id) || 0,
      completed_this_month: completedMap.get(member.id) || 0,
    }));

    // 8. 부서(position) 기반 그룹핑
    const groupedByDept = membersWithStats.reduce(
      (acc, member) => {
        const dept = member.position || '미지정';
        if (!acc[dept]) {
          acc[dept] = [];
        }
        acc[dept].push(member);
        return acc;
      },
      {} as Record<string, typeof membersWithStats>
    );

    // 로깅 (성능 모니터링)
    console.log('[Team Members API]', {
      userId: session.user.id,
      orgType: getOrganizationType(currentUser.role),
      searchTerm: searchTerm || null,
      memberCount: members.length,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        members: membersWithStats,
        groupedByDept,
        currentUser: {
          id: currentUser.id,
          name: currentUser.full_name,
          role: currentUser.role,
          orgType: getOrganizationType(currentUser.role),
        },
      },
    });
  } catch (error) {
    console.error('[Team Members API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
