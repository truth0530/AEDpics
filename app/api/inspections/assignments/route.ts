import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 대량 일정추가 핸들러
async function handleBulkAssignment(
  equipmentSerials: string[],
  params: {
    assignedTo?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    assignmentType: string;
    priorityLevel: number;
    notes?: string;
  }
) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 프로필 조회
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true, organizationId: true }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 권한 확인
    const allowedRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: '일정추가 권한이 없습니다.' }, { status: 403 });
    }

    // assignedTo 기본값 설정 (없으면 자기 자신에게 할당)
    const finalAssignedTo = params.assignedTo || session.user.id;

    // 타인에게 할당하는 경우 delegation 권한 확인
    if (finalAssignedTo !== session.user.id) {
      const assigneeProfile = await prisma.user_profiles.findUnique({
        where: { id: finalAssignedTo },
        select: { organizationId: true, regionCode: true }
      });

      if (!assigneeProfile) {
        return NextResponse.json({ error: '할당받을 사용자를 찾을 수 없습니다.' }, { status: 404 });
      }

      // Scope validation based on requester's role
      const requesterRole = userProfile.role;
      const broadRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin'];

      if (requesterRole === 'local_admin') {
        // local_admin can only assign within their organization
        if (assigneeProfile.organizationId !== userProfile.organizationId) {
          return NextResponse.json({
            error: '보건소 관리자는 같은 조직 내에서만 할당할 수 있습니다.'
          }, { status: 403 });
        }
      } else if (broadRoles.includes(requesterRole)) {
        // Broader roles can assign across organizations (already allowed)
        // No additional restrictions
      } else {
        // Other roles cannot assign to others
        return NextResponse.json({
          error: '타인에게 할당할 권한이 없습니다.'
        }, { status: 403 });
      }
    }

    // Prisma를 사용한 대량 삽입 (RPC 대체)
    const existingAssignments = await prisma.inspectionsAssignment.findMany({
      where: {
        equipmentSerial: { in: equipmentSerials },
        assignedTo: finalAssignedTo,
        status: { in: ['pending', 'in_progress'] }
      },
      select: { equipmentSerial: true }
    });

    const existingSerials = new Set(existingAssignments.map(a => a.equipmentSerial));
    const newSerials = equipmentSerials.filter(s => !existingSerials.has(s));

    if (newSerials.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 장비가 이미 할당되어 있습니다.',
        stats: {
          total: equipmentSerials.length,
          created: 0,
          skipped: equipmentSerials.length,
          failed: 0
        }
      });
    }

    // 대량 생성
    try {
      const result = await prisma.inspectionsAssignment.createMany({
        data: newSerials.map(serial => ({
          equipmentSerial: serial,
          assignedTo: finalAssignedTo,
          assignedBy: session.user.id,
          assignmentType: params.assignmentType as any,
          scheduledDate: params.scheduledDate ? new Date(params.scheduledDate) : null,
          scheduledTime: params.scheduledTime ? new Date(`1970-01-01T${params.scheduledTime}`) : null,
          priorityLevel: params.priorityLevel,
          notes: params.notes || null,
          status: 'pending'
        })),
        skipDuplicates: true
      });

      return NextResponse.json({
        success: true,
        message: `${result.count}개의 일정이 추가되었습니다.`,
        stats: {
          total: equipmentSerials.length,
          created: result.count,
          skipped: equipmentSerials.length - result.count,
          failed: 0
        }
      });
    } catch (error: any) {
      console.error('[Bulk Assignment Creation Error]', error);
      return NextResponse.json({
        error: '일정추가가 실패했습니다.',
        details: error.message
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Bulk Assignment Handler Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/inspections/assignments - 일정추가 (단일 또는 대량)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      equipmentSerial,
      equipmentSerials, // 대량 일정추가용 배열
      assignedTo,
      scheduledDate,
      scheduledTime,
      assignmentType = 'scheduled',
      priorityLevel = 0,
      notes
    } = body;

    // 대량 일정추가 처리
    if (equipmentSerials && Array.isArray(equipmentSerials) && equipmentSerials.length > 0) {
      return handleBulkAssignment(equipmentSerials, {
        assignedTo,
        scheduledDate,
        scheduledTime,
        assignmentType,
        priorityLevel,
        notes
      });
    }

    // 필수 파라미터 검증 (단일 일정추가)
    if (!equipmentSerial) {
      return NextResponse.json(
        { error: '장비 시리얼 번호는 필수입니다.' },
        { status: 400 }
      );
    }

    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 사용자 프로필 조회
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true, organizationId: true }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 권한 확인 (보건소 담당자 이상만 가능)
    const allowedRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json(
        { error: '일정추가 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // assignedTo 기본값 설정 (없으면 자기 자신에게 할당)
    const finalAssignedTo = assignedTo || session.user.id;

    // 타인에게 할당하는 경우 delegation 권한 확인
    if (finalAssignedTo !== session.user.id) {
      const assigneeProfile = await prisma.user_profiles.findUnique({
        where: { id: finalAssignedTo },
        select: { organizationId: true, regionCode: true }
      });

      if (!assigneeProfile) {
        return NextResponse.json({ error: '할당받을 사용자를 찾을 수 없습니다.' }, { status: 404 });
      }

      // Scope validation based on requester's role
      const requesterRole = userProfile.role;
      const broadRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin'];

      if (requesterRole === 'local_admin') {
        // local_admin can only assign within their organization
        if (assigneeProfile.organizationId !== userProfile.organizationId) {
          return NextResponse.json({
            error: '보건소 관리자는 같은 조직 내에서만 할당할 수 있습니다.'
          }, { status: 403 });
        }
      } else if (broadRoles.includes(requesterRole)) {
        // Broader roles can assign across organizations (already allowed)
        // No additional restrictions
      } else {
        // Other roles cannot assign to others
        return NextResponse.json({
          error: '타인에게 할당할 권한이 없습니다.'
        }, { status: 403 });
      }
    }

    // 병렬 쿼리로 성능 개선 (순차 → 병렬)
    const [existing, aedDevice] = await Promise.all([
      // 1. 중복 방지: 동일 장비 + 동일 점검원 + active 상태 확인
      prisma.inspectionsAssignment.findFirst({
        where: {
          equipmentSerial: equipmentSerial,
          assignedTo: finalAssignedTo,
          status: { in: ['pending', 'in_progress'] }
        },
        select: {
          id: true,
          status: true,
          scheduledDate: true
        }
      }),

      // 2. AED 장비 존재 확인
      prisma.aedData.findUnique({
        where: { equipmentSerial: equipmentSerial },
        select: {
          equipmentSerial: true,
          installationInstitution: true
        }
      })
    ]);

    // 검증 로직
    if (existing) {
      return NextResponse.json(
        {
          error: '이미 할당된 장비입니다.',
          existingAssignment: {
            id: existing.id,
            status: existing.status,
            scheduledDate: existing.scheduledDate
          }
        },
        { status: 409 }
      );
    }

    if (!aedDevice) {
      return NextResponse.json(
        { error: '존재하지 않는 장비입니다.' },
        { status: 404 }
      );
    }

    // 일정추가 생성
    try {
      const assignment = await prisma.inspectionsAssignment.create({
        data: {
          equipmentSerial: equipmentSerial,
          assignedTo: finalAssignedTo,
          assignedBy: session.user.id,
          assignmentType: assignmentType as any,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          scheduledTime: scheduledTime ? new Date(`1970-01-01T${scheduledTime}`) : null,
          priorityLevel: priorityLevel,
          notes: notes,
          status: 'pending'
        },
        include: {
          assignedToUser: {
            select: { id: true, fullName: true, role: true }
          },
          assignedByUser: {
            select: { id: true, fullName: true, role: true }
          }
        }
      });

      return NextResponse.json({
        success: true,
        data: assignment,
        message: '일정추가가 완료되었습니다.'
      });
    } catch (insertError: any) {
      console.error('[Assignment Creation Error]', insertError);

      // Check for unique constraint violation (Prisma error code P2002)
      if (insertError.code === 'P2002') {
        // Fetch existing assignment info to return in response
        const existingAssignment = await prisma.inspectionsAssignment.findFirst({
          where: {
            equipmentSerial: equipmentSerial,
            assignedTo: finalAssignedTo,
            status: { in: ['pending', 'in_progress'] }
          },
          select: {
            id: true,
            status: true,
            scheduledDate: true
          }
        });

        return NextResponse.json(
          {
            error: '이미 할당된 장비입니다.',
            existingAssignment: existingAssignment || null
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: insertError.message },
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

// GET /api/inspections/assignments - 할당 목록 조회
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams;
    const assignedTo = searchParams.get('assignedTo');
    const assignedBy = searchParams.get('assignedBy');
    const status = searchParams.get('status');
    const equipmentSerial = searchParams.get('equipmentSerial');

    // 쿼리 조건 구성
    const where: any = {};

    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    if (assignedBy) {
      where.assignedBy = assignedBy;
    }

    if (status) {
      where.status = status;
    }

    if (equipmentSerial) {
      where.equipmentSerial = equipmentSerial;
    }

    const data = await prisma.inspectionsAssignment.findMany({
      where,
      include: {
        assignedToUser: {
          select: { id: true, fullName: true, role: true, email: true }
        },
        assignedByUser: {
          select: { id: true, fullName: true, role: true, email: true }
        }
      },
      orderBy: [
        { scheduledDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    // 통계 계산
    const stats = {
      total: data.length,
      pending: data.filter(a => a.status === 'pending').length,
      in_progress: data.filter(a => a.status === 'in_progress').length,
      completed: data.filter(a => a.status === 'completed').length,
      cancelled: data.filter(a => a.status === 'cancelled').length,
      overdue: data.filter(a => {
        if (!a.scheduledDate) return false;
        return a.status === 'pending' && new Date(a.scheduledDate) < new Date();
      }).length,
      today: data.filter(a => {
        if (!a.scheduledDate) return false;
        const today = new Date().toISOString().split('T')[0];
        const schedDate = a.scheduledDate.toISOString().split('T')[0];
        return schedDate === today && a.status === 'pending';
      }).length
    };

    return NextResponse.json({
      success: true,
      data,
      stats
    });

  } catch (error) {
    console.error('[API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/inspections/assignments?id={id} - 일정 상태 변경
export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const assignmentId = searchParams.get('id');

    if (!assignmentId) {
      return NextResponse.json(
        { error: '할당 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status: newStatus, notes } = body;

    // 허용된 상태값 검증
    const allowedStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!newStatus || !allowedStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태값입니다.' },
        { status: 400 }
      );
    }

    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 할당 조회
    const assignment = await prisma.inspectionsAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        status: true,
        assignedTo: true,
        assignedBy: true,
        equipmentSerial: true
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: '할당을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 상태 변경 규칙 검증
    const currentStatus = assignment.status;

    // 완료된 일정은 변경 불가
    if (currentStatus === 'completed') {
      return NextResponse.json(
        { error: '완료된 일정은 변경할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 취소는 pending 또는 in_progress 상태에서 가능 (completed는 이미 위에서 걸러짐)

    // 취소는 할당한 사람만 가능
    if (newStatus === 'cancelled' && assignment.assignedBy !== session.user.id) {
      return NextResponse.json(
        { error: '일정을 취소할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 시작은 할당받은 사람만 가능 (pending -> in_progress)
    if (newStatus === 'in_progress' && assignment.assignedTo !== session.user.id) {
      return NextResponse.json(
        { error: '점검을 시작할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 완료는 할당받은 사람만 가능 (in_progress -> completed)
    if (newStatus === 'completed' && assignment.assignedTo !== session.user.id) {
      return NextResponse.json(
        { error: '점검을 완료할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // in_progress 상태에서 취소하는 경우: 활성 세션 삭제
    if (newStatus === 'cancelled' && currentStatus === 'in_progress') {
      // 활성 점검 세션 삭제
      await prisma.inspectionsSession.deleteMany({
        where: {
          equipmentSerial: assignment.equipmentSerial,
          status: 'active'
        }
      });
    }

    // 상태 업데이트 (트리거가 started_at, completed_at, cancelled_at 자동 설정)
    const updateData: any = {
      status: newStatus as any
    };

    if (notes) {
      updateData.notes = notes;
    }

    // 타임스탬프 수동 설정 (Prisma에는 DB 트리거가 없으므로)
    if (newStatus === 'in_progress' && currentStatus === 'pending') {
      updateData.startedAt = new Date();
    } else if (newStatus === 'completed') {
      updateData.completedAt = new Date();
    } else if (newStatus === 'cancelled') {
      updateData.cancelledAt = new Date();
    }

    const updatedAssignment = await prisma.inspectionsAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        assignedToUser: {
          select: { id: true, fullName: true, role: true }
        },
        assignedByUser: {
          select: { id: true, fullName: true, role: true }
        }
      }
    });

    // 상태별 메시지
    const statusMessages: Record<string, string> = {
      'in_progress': '점검이 시작되었습니다.',
      'completed': '점검이 완료되었습니다.',
      'cancelled': '일정이 취소되었습니다.',
      'pending': '일정이 대기 상태로 변경되었습니다.'
    };

    return NextResponse.json({
      success: true,
      data: updatedAssignment,
      message: statusMessages[newStatus] || '상태가 변경되었습니다.'
    });

  } catch (error) {
    console.error('[API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/inspections/assignments?id={id} - 일정취소 (PATCH로 대체 권장)
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const assignmentId = searchParams.get('id');

    if (!assignmentId) {
      return NextResponse.json(
        { error: '할당 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 할당 조회 (권한 확인용)
    const assignment = await prisma.inspectionsAssignment.findUnique({
      where: { id: assignmentId },
      select: { assignedBy: true, status: true }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: '할당을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 본인이 생성한 할당만 삭제 가능
    if (assignment.assignedBy !== session.user.id) {
      return NextResponse.json(
        { error: '삭제 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 완료된 할당은 삭제 불가
    if (assignment.status === 'completed') {
      return NextResponse.json(
        { error: '완료된 할당은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // pending 상태만 취소 가능
    if (assignment.status !== 'pending') {
      return NextResponse.json(
        { error: 'pending 상태의 일정만 취소할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 삭제 (취소 상태로 변경)
    try {
      await prisma.inspectionsAssignment.update({
        where: { id: assignmentId },
        data: {
          status: 'cancelled',
          cancelledAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: '일정이 취소되었습니다.'
      });
    } catch (deleteError) {
      console.error('[Assignment Delete Error]', deleteError);
      return NextResponse.json(
        { error: 'Failed to cancel assignment' },
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
