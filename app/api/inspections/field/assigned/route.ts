import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            regionCode: true,
            cityCode: true,
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
    const activeSessions = await prisma.inspectionsSession.findMany({
      where: {
        inspectorId: session.user.id,
        completedAt: null
      },
      select: {
        equipmentSerial: true
      }
    });

    const activeSessionSerials = new Set(
      activeSessions.map(s => s.equipmentSerial)
    );

    // 2단계: 할당된 장비 목록 조회
    try {
      const assignments = await prisma.inspectionsAssignment.findMany({
        where: {
          assignedTo: session.user.id,
          status: {
            in: ['pending', 'in_progress']
          }
        },
        select: {
          id: true,
          equipmentSerial: true,
          status: true,
          scheduledDate: true,
          createdAt: true,
          startedAt: true
        },
        orderBy: {
          scheduledDate: 'asc'
        }
      });

      // 3단계: 활성 세션이 없는 장비만 필터링
      const assignmentsWithoutSession = assignments.filter(
        a => !activeSessionSerials.has(a.equipmentSerial)
      );

      // 4단계: 장비 상세 정보 조회
      const equipmentSerials = assignmentsWithoutSession.map(a => a.equipmentSerial);
      let data: any[] = [];

      if (equipmentSerials.length > 0) {
        const aedData = await prisma.aedData.findMany({
          where: {
            equipmentSerial: {
              in: equipmentSerials
            }
          }
        });

        // 5단계: 데이터 결합 및 urgency 계산
        const now = new Date();
        data = assignmentsWithoutSession.map(assignment => {
          const aed = aedData.find(a => a.equipmentSerial === assignment.equipmentSerial);

          // inspection_urgency 계산
          let inspection_urgency = 'upcoming';
          if (assignment.scheduledDate) {
            const scheduledDate = new Date(assignment.scheduledDate);
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
            scheduled_date: assignment.scheduledDate,
            assigned_at: assignment.createdAt,
            started_at: assignment.startedAt,
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
      console.error('[Assigned AED Query Error]', assignmentError);
      return NextResponse.json(
        { error: 'Failed to fetch assignments' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
