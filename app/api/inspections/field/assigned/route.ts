import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
// GET /api/inspections/field/assigned - 현장점검용 할당된 AED 목록
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 프로필 조회
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            type: true,
            region_code: true,
            city_code: true,
            latitude: true,
            longitude: true
          }
        }
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 1단계: 활성 세션이 있는 장비 목록 조회 (점검대상목록에서 제외하기 위함)
    const activeSessions = await prisma.inspection_sessions.findMany({
      where: {
        inspector_id: session.user.id,
        completed_at: null
      },
      select: {
        equipment_serial: true
      }
    });

    const activeSessionSerials = new Set(
      activeSessions.map(s => s.equipment_serial)
    );

    // 2단계: 할당된 장비 목록 조회
    try {
      const assignments = await prisma.inspection_assignments.findMany({
        where: {
          assigned_to: session.user.id,
          status: {
            in: ['pending', 'in_progress']
          }
        },
        select: {
          id: true,
          equipment_serial: true,
          status: true,
          scheduled_date: true,
          created_at: true,
          started_at: true
        },
        orderBy: {
          scheduled_date: 'asc'
        }
      });

      // 3단계: 활성 세션이 없는 장비만 필터링
      const assignmentsWithoutSession = assignments.filter(
        a => !activeSessionSerials.has(a.equipment_serial)
      );

      // 4단계: 장비 상세 정보 조회
      const equipmentSerials = assignmentsWithoutSession.map(a => a.equipment_serial);
      let data: any[] = [];

      if (equipmentSerials.length > 0) {
        const aedData = await prisma.aed_data.findMany({
          where: {
            equipment_serial: {
              in: equipmentSerials
            }
          }
        });

        // 5단계: 데이터 결합 및 urgency 계산
        const now = new Date();
        data = assignmentsWithoutSession.map(assignment => {
          const aed = aedData.find(a => a.equipment_serial === assignment.equipment_serial);

          // inspection_urgency 계산
          let inspection_urgency = 'upcoming';
          if (assignment.scheduled_date) {
            const scheduledDate = new Date(assignment.scheduled_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            scheduledDate.setHours(0, 0, 0, 0);

            if (scheduledDate < today) {
              inspection_urgency = 'overdue';
            } else if (scheduledDate.getTime() === today.getTime()) {
              inspection_urgency = 'today';
            }
          }

          return {
            ...aed,
            assignment_id: assignment.id,
            assignment_status: assignment.status,
            scheduled_date: assignment.scheduled_date,
            assigned_at: assignment.created_at,
            started_at: assignment.started_at,
            inspection_urgency
          };
        });

        // urgency 우선순위로 정렬 (overdue > today > upcoming)
        const urgencyOrder = { overdue: 0, today: 1, upcoming: 2 };
        data.sort((a, b) => {
          const urgencyDiff = urgencyOrder[a.inspection_urgency as keyof typeof urgencyOrder] -
                             urgencyOrder[b.inspection_urgency as keyof typeof urgencyOrder];
          if (urgencyDiff !== 0) return urgencyDiff;

          // 같은 urgency면 scheduled_date로 정렬
          if (a.scheduled_date && b.scheduled_date) {
            return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
          }
          return 0;
        });
      }

      // 통계 계산
      const stats = {
        total: data.length,
        overdue: data.filter(d => d.inspection_urgency === 'overdue').length,
        today: data.filter(d => d.inspection_urgency === 'today').length,
        upcoming: data.filter(d => d.inspection_urgency === 'upcoming').length,
        in_progress: data.filter(d => d.assignment_status === 'in_progress').length,
      };

      return NextResponse.json({
        success: true,
        data,
        stats,
        userRole: userProfile.role
      });

    } catch (assignmentError) {
      logger.error('InspectionFieldAssigned:GET', 'Assigned AED query error',
        assignmentError instanceof Error ? assignmentError : { assignmentError }
      );
      return NextResponse.json(
        { error: 'Failed to fetch assignments' },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error('InspectionFieldAssigned:GET', 'API error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
