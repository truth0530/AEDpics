import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

// PUT /api/inspections/assignments/reassign - 일정 재배정
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { assignmentIds, newAssignedTo } = body;

    // 검증
    if (!assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return NextResponse.json(
        { error: '재배정할 일정 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!newAssignedTo) {
      return NextResponse.json(
        { error: '새로운 담당자 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 현재 사용자 프로필 조회
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true, organization_id: true }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 새로운 담당자 프로필 조회
    const newAssigneeProfile = await prisma.user_profiles.findUnique({
      where: { id: newAssignedTo },
      select: { organization_id: true, region_code: true, full_name: true }
    });

    if (!newAssigneeProfile) {
      return NextResponse.json(
        { error: '새로운 담당자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 확인
    const requesterRole = userProfile.role;
    const broadRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin'];

    if (requesterRole === 'local_admin') {
      // local_admin은 같은 조직 내에서만 재배정 가능
      if (newAssigneeProfile.organization_id !== userProfile.organization_id) {
        return NextResponse.json({
          error: '보건소 관리자는 같은 조직 내에서만 재배정할 수 있습니다.'
        }, { status: 403 });
      }
    } else if (!broadRoles.includes(requesterRole)) {
      // 다른 역할은 재배정 권한 없음
      return NextResponse.json({
        error: '일정을 재배정할 권한이 없습니다.'
      }, { status: 403 });
    }

    // 재배정할 일정 조회
    const assignments = await prisma.inspection_assignments.findMany({
      where: {
        id: { in: assignmentIds },
        status: { in: ['pending', 'in_progress'] }
      },
      select: {
        id: true,
        assigned_to: true,
        assigned_by: true,
        status: true,
        equipment_serial: true
      }
    });

    if (assignments.length === 0) {
      return NextResponse.json(
        { error: '재배정할 수 있는 일정이 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 진행 중인 일정이 있는지 확인
    const inProgressAssignments = assignments.filter(a => a.status === 'in_progress');
    if (inProgressAssignments.length > 0) {
      return NextResponse.json({
        error: '진행 중인 일정은 재배정할 수 없습니다.',
        inProgressCount: inProgressAssignments.length
      }, { status: 400 });
    }

    // 대량 업데이트
    const updateResult = await prisma.inspection_assignments.updateMany({
      where: {
        id: { in: assignments.map(a => a.id) }
      },
      data: {
        assigned_to: newAssignedTo,
        updated_at: new Date()
      }
    });

    // 재배정 로그 기록 (audit_logs에 기록)
    try {
      const { randomUUID } = await import('crypto');
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          user_id: session.user.id,
          action: 'reassign_inspections',
          metadata: {
            assignmentIds: assignments.map(a => a.id),
            from: assignments.map(a => ({
              id: a.id,
              assigned_to: a.assigned_to,
              equipment_serial: a.equipment_serial
            })),
            to: newAssignedTo,
            count: updateResult.count
          },
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      });
    } catch (logError) {
      logger.error('InspectionReassign:PUT', 'Audit log error',
        logError instanceof Error ? logError : { logError }
      );
      // 로그 실패해도 재배정은 완료
    }

    return NextResponse.json({
      success: true,
      message: `${updateResult.count}개의 일정이 재배정되었습니다.`,
      data: {
        updated: updateResult.count,
        newAssignee: {
          id: newAssignedTo,
          name: newAssigneeProfile.full_name
        }
      }
    });

  } catch (error) {
    logger.error('InspectionReassign:PUT', 'Reassign API error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
