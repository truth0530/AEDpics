import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 현재 사용자의 조직 ID 조회
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        organization_id: true,
        role: true,
        full_name: true
      }
    });

    if (!userProfile?.organization_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // 팀원 목록 조회
    const members = await prisma.team_members.findMany({
      where: {
        organization_id: userProfile.organization_id,
        is_active: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        position: true,
        member_type: true,
        user_profile_id: true
      },
      orderBy: [
        { position: 'asc' },
        { name: 'asc' }
      ]
    });

    // 팀원별 할당 통계 (할당된 일정 수)
    const memberIds = members.map(m => m.user_profile_id).filter(Boolean) as string[];

    const assignmentCounts = await prisma.inspection_assignments.groupBy({
      by: ['assigned_to'],
      where: {
        assigned_to: { in: memberIds },
        status: { in: ['pending', 'in_progress'] }
      },
      _count: {
        id: true
      }
    });

    const assignmentMap = new Map(
      assignmentCounts.map(a => [a.assigned_to, a._count.id])
    );

    // 완료 통계 (이번 달)
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
          lte: endOfMonth
        }
      },
      _count: {
        id: true
      }
    });

    const completedMap = new Map(
      completedCounts.map(a => [a.assigned_to, a._count.id])
    );

    // 응답 데이터 구성
    const membersWithStats = members.map(member => ({
      ...member,
      current_assigned: member.user_profile_id
        ? assignmentMap.get(member.user_profile_id) || 0
        : 0,
      completed_this_month: member.user_profile_id
        ? completedMap.get(member.user_profile_id) || 0
        : 0
    }));

    // 부서별 그룹핑
    const groupedByDept = membersWithStats.reduce((acc, member) => {
      const dept = member.position || '미지정';
      if (!acc[dept]) {
        acc[dept] = [];
      }
      acc[dept].push(member);
      return acc;
    }, {} as Record<string, typeof membersWithStats>);

    return NextResponse.json({
      success: true,
      data: {
        members: membersWithStats,
        groupedByDept,
        currentUser: {
          id: session.user.id,
          name: userProfile.full_name,
          role: userProfile.role
        }
      }
    });

  } catch (error) {
    console.error('[Team Members API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
