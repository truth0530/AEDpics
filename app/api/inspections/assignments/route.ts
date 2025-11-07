import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { resolveAccessScope } from '@/lib/auth/access-control';
import { canAccessEquipment, buildEquipmentFilter } from '@/lib/auth/equipment-access';

import { prisma } from '@/lib/prisma';
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
      select: {
        id: true,
        role: true,
        organization_id: true,
        region_code: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 권한 범위 계산 (v5.2: equipment-centric pattern)
    const accessScope = resolveAccessScope(userProfile as any);

    // 권한 확인: 할당 권한이 있는 역할인지 검증
    const allowedRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin'];
    if (!allowedRoles.includes(userProfile.role)) {
      logger.warn('InspectionAssignments:Bulk', 'Assignment permission denied (insufficient role)', {
        userId: session.user.id,
        role: userProfile.role
      });
      return NextResponse.json({ error: '일정추가 권한이 없습니다.' }, { status: 403 });
    }

    // assignedTo 기본값 설정 (없으면 자기 자신에게 할당)
    const finalAssignedTo = params.assignedTo || session.user.id;

    // 타인에게 할당하는 경우 delegation 권한 확인
    if (finalAssignedTo !== session.user.id) {
      const assigneeProfile = await prisma.user_profiles.findUnique({
        where: { id: finalAssignedTo },
        select: { organization_id: true, region_code: true }
      });

      if (!assigneeProfile) {
        return NextResponse.json({ error: '할당받을 사용자를 찾을 수 없습니다.' }, { status: 404 });
      }

      // Scope validation based on requester's role
      const requesterRole = userProfile.role;
      const broadRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin'];

      if (requesterRole === 'local_admin') {
        // local_admin can only assign within their organization
        if (assigneeProfile.organization_id !== userProfile.organization_id) {
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
    const existingAssignments = await prisma.inspection_assignments.findMany({
      where: {
        equipment_serial: { in: equipmentSerials },
        assigned_to: finalAssignedTo,
        status: { in: ['pending', 'in_progress'] }
      },
      select: { equipment_serial: true }
    });

    const existingSerials = new Set(existingAssignments.map(a => a.equipment_serial));
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
      const result = await prisma.inspection_assignments.createMany({
        data: newSerials.map(serial => ({
          equipment_serial: serial,
          assigned_to: finalAssignedTo,
          assigned_by: session.user.id,
          assignment_type: params.assignmentType as any,
          scheduled_date: params.scheduledDate ? new Date(params.scheduledDate) : null,
          scheduled_time: params.scheduledTime ? new Date(`1970-01-01T${params.scheduledTime}`) : null,
          priority_level: params.priorityLevel,
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
      logger.error('InspectionAssignments:POST', 'Bulk assignment creation error',
        error instanceof Error ? error : { error }
      );
      return NextResponse.json({
        error: '일정추가가 실패했습니다.',
        details: error.message
      }, { status: 500 });
    }

  } catch (error) {
    logger.error('InspectionAssignments:POST', 'Bulk assignment handler error',
      error instanceof Error ? error : { error }
    );
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

    // 사용자 프로필 조회 (v5.2: equipment-centric pattern)
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        organization_id: true,
        region_code: true,
        region: true,
        district: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // === 권한 범위 계산 (v5.2: equipment-centric pattern) ===
    const accessScope = resolveAccessScope(userProfile as any);

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
        select: { organization_id: true, region_code: true }
      });

      if (!assigneeProfile) {
        return NextResponse.json({ error: '할당받을 사용자를 찾을 수 없습니다.' }, { status: 404 });
      }

      // Scope validation based on requester's role
      const requesterRole = userProfile.role;
      const broadRoles = ['master', 'emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin'];

      if (requesterRole === 'local_admin') {
        // local_admin can only assign within their organization
        if (assigneeProfile.organization_id !== userProfile.organization_id) {
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
      prisma.inspection_assignments.findFirst({
        where: {
          equipment_serial: equipmentSerial,
          assigned_to: finalAssignedTo,
          status: { in: ['pending', 'in_progress'] }
        },
        select: {
          id: true,
          status: true,
          scheduled_date: true
        }
      }),

      // 2. AED 장비 존재 확인 (equipment access 검증용 필드 포함)
      prisma.aed_data.findUnique({
        where: { equipment_serial: equipmentSerial },
        select: {
          equipment_serial: true,
          installation_institution: true,
          sido: true,
          gugun: true,
          jurisdiction_health_center: true
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
            scheduled_date: existing.scheduled_date
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

    // === Equipment 접근 권한 검증 (v5.2: equipment-centric pattern) ===
    const canAccess = canAccessEquipment(
      {
        equipment_serial: aedDevice.equipment_serial,
        sido: aedDevice.sido || null,
        gugun: aedDevice.gugun || null,
        jurisdiction_health_center: aedDevice.jurisdiction_health_center || null
      },
      accessScope,
      'address'
    );

    if (!canAccess) {
      logger.warn('InspectionAssignments:POST', 'Equipment access denied', {
        userId: session.user.id,
        role: userProfile.role,
        equipmentSerial: aedDevice.equipment_serial,
        equipmentSido: aedDevice.sido,
        equipmentGugun: aedDevice.gugun
      });

      return NextResponse.json(
        { error: 'You do not have permission to assign this equipment' },
        { status: 403 }
      );
    }

    // 일정추가 생성
    try {
      const assignment = await prisma.inspection_assignments.create({
        data: {
          equipment_serial: equipmentSerial,
          assigned_to: finalAssignedTo,
          assigned_by: session.user.id,
          assignment_type: assignmentType as any,
          scheduled_date: scheduledDate ? new Date(scheduledDate) : null,
          scheduled_time: scheduledTime ? new Date(`1970-01-01T${scheduledTime}`) : null,
          priority_level: priorityLevel,
          notes: notes,
          status: 'pending'
        },
        include: {
          user_profiles_inspection_assignments_assigned_toTouser_profiles: {
            select: { id: true, full_name: true, role: true }
          },
          user_profiles_inspection_assignments_assigned_byTouser_profiles: {
            select: { id: true, full_name: true, role: true }
          }
        }
      });

      // 감사 로그 기록 (v5.2: equipment-centric pattern)
      logger.info('InspectionAssignments:POST', 'Assignment created successfully', {
        userId: session.user.id,
        role: userProfile.role,
        assignmentId: assignment.id,
        equipmentSerial: equipmentSerial,
        assignedTo: finalAssignedTo,
        equipmentSido: aedDevice.sido,
        equipmentGugun: aedDevice.gugun,
        timestamp: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        data: assignment,
        message: '일정추가가 완료되었습니다.'
      });
    } catch (insertError: any) {
      logger.error('InspectionAssignments:POST', 'Assignment creation error',
        insertError instanceof Error ? insertError : { insertError }
      );

      // Check for unique constraint violation (Prisma error code P2002)
      if (insertError.code === 'P2002') {
        // Fetch existing assignment info to return in response
        const existingAssignment = await prisma.inspection_assignments.findFirst({
          where: {
            equipment_serial: equipmentSerial,
            assigned_to: finalAssignedTo,
            status: { in: ['pending', 'in_progress'] }
          },
          select: {
            id: true,
            status: true,
            scheduled_date: true
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
    logger.error('InspectionAssignments:POST', 'API error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/inspections/assignments - 할당 목록 조회 (v5.2: Equipment-Centric Access Control)
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // === Step 1: 사용자 프로필 조회 ===
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        region_code: true,
        region: true,
        district: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // === Step 2: 권한 범위 계산 (v5.2: equipment-centric pattern) ===
    const accessScope = resolveAccessScope(userProfile as any);

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams;
    const assignedTo = searchParams.get('assignedTo');
    const assignedBy = searchParams.get('assignedBy');
    const status = searchParams.get('status');
    const equipmentSerial = searchParams.get('equipmentSerial');

    // === Step 3: 쿼리 조건 구성 ===
    const where: any = {};

    if (assignedTo) {
      where.assigned_to = assignedTo;
    }

    if (assignedBy) {
      where.assigned_by = assignedBy;
    }

    if (status) {
      where.status = status;
    }

    if (equipmentSerial) {
      where.equipment_serial = equipmentSerial;
    }

    // === Step 4: Equipment 접근 범위 필터링 (v5.2: equipment-centric pattern) ===
    // Master와 상위 관리자는 모든 할당 조회 가능, 그 외는 접근 가능한 equipment만 조회
    if (
      userProfile.role !== 'master' &&
      userProfile.role !== 'emergency_center_admin' &&
      userProfile.role !== 'regional_emergency_center_admin'
    ) {
      const equipmentFilter = buildEquipmentFilter(accessScope, 'address');
      if (Object.keys(equipmentFilter).length > 0) {
        where.aed_data = equipmentFilter;
      }
    }

    // === Step 5: 데이터 조회 ===
    // Note: aed_data relationship not explicitly defined in Prisma schema
    // To access aed_data, fetch separately using equipment_serial FK if needed
    const data = await prisma.inspection_assignments.findMany({
      where,
      include: {
        user_profiles_inspection_assignments_assigned_toTouser_profiles: {
          select: { id: true, full_name: true, role: true, email: true }
        },
        user_profiles_inspection_assignments_assigned_byTouser_profiles: {
          select: { id: true, full_name: true, role: true, email: true }
        }
      },
      orderBy: [
        { scheduled_date: 'asc' },
        { created_at: 'desc' }
      ]
    });

    // === Step 6: 통계 계산 ===
    const stats = {
      total: data.length,
      pending: data.filter(a => a.status === 'pending').length,
      in_progress: data.filter(a => a.status === 'in_progress').length,
      completed: data.filter(a => a.status === 'completed').length,
      cancelled: data.filter(a => a.status === 'cancelled').length,
      overdue: data.filter(a => {
        if (!a.scheduled_date) return false;
        return a.status === 'pending' && new Date(a.scheduled_date) < new Date();
      }).length,
      today: data.filter(a => {
        if (!a.scheduled_date) return false;
        const today = new Date().toISOString().split('T')[0];
        const schedDate = a.scheduled_date.toISOString().split('T')[0];
        return schedDate === today && a.status === 'pending';
      }).length
    };

    // === Step 7: 감사 로그 기록 (v5.2: equipment-centric pattern) ===
    logger.info('InspectionAssignments:GET', 'Assignment list retrieved successfully', {
      userId: session.user.id,
      role: userProfile.role,
      recordCount: data.length,
      filters: {
        assignedTo: assignedTo || undefined,
        assignedBy: assignedBy || undefined,
        status: status || undefined,
        equipmentSerial: equipmentSerial || undefined
      },
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      data,
      stats
    });

  } catch (error) {
    logger.error('InspectionAssignments:GET', 'API error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/inspections/assignments?id={id} - 일정 상태 변경 (v5.2: Equipment-Centric Access Control)
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

    // === Step 1: 인증 확인 ===
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // === Step 2: 사용자 프로필 조회 (v5.2: equipment-centric pattern) ===
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        region_code: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // === Step 3: 권한 범위 계산 (v5.2: equipment-centric pattern) ===
    const accessScope = resolveAccessScope(userProfile as any);

    // === Step 4: 할당 조회 (equipment access 검증용 필드 포함) ===
    // Note: aed_data relationship not explicitly defined in Prisma schema
    // Need to fetch aed_data separately using equipment_serial FK
    const assignment = await prisma.inspection_assignments.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        status: true,
        assigned_to: true,
        assigned_by: true,
        equipment_serial: true
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: '할당을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // === Step 5: Equipment 접근 권한 검증 (v5.2: equipment-centric pattern) ===
    // Fetch aed_data separately using equipment_serial FK
    const aedData = await prisma.aed_data.findUnique({
      where: { equipment_serial: assignment.equipment_serial },
      select: {
        equipment_serial: true,
        sido: true,
        gugun: true,
        jurisdiction_health_center: true
      }
    });

    if (aedData) {
      const canAccess = canAccessEquipment(
        {
          equipment_serial: aedData.equipment_serial,
          sido: aedData.sido || null,
          gugun: aedData.gugun || null,
          jurisdiction_health_center: aedData.jurisdiction_health_center || null
        },
        accessScope,
        'address'
      );

      if (!canAccess) {
        logger.warn('InspectionAssignments:PATCH', 'Equipment access denied', {
          userId: session.user.id,
          role: userProfile.role,
          assignmentId,
          equipmentSerial: assignment.equipment_serial,
          equipmentSido: aedData.sido,
          equipmentGugun: aedData.gugun
        });

        return NextResponse.json(
          { error: 'You do not have permission to modify this assignment' },
          { status: 403 }
        );
      }
    }

    // === Step 6: 상태 변경 규칙 검증 ===
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
    if (newStatus === 'cancelled' && assignment.assigned_by !== session.user.id) {
      return NextResponse.json(
        { error: '일정을 취소할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 시작은 할당받은 사람만 가능 (pending -> in_progress)
    if (newStatus === 'in_progress' && assignment.assigned_to !== session.user.id) {
      return NextResponse.json(
        { error: '점검을 시작할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 완료는 할당받은 사람만 가능 (in_progress -> completed)
    if (newStatus === 'completed' && assignment.assigned_to !== session.user.id) {
      return NextResponse.json(
        { error: '점검을 완료할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // in_progress 상태에서 취소하는 경우: 활성 세션 삭제
    if (newStatus === 'cancelled' && currentStatus === 'in_progress') {
      // 활성 점검 세션 삭제
      await prisma.inspection_sessions.deleteMany({
        where: {
          equipment_serial: assignment.equipment_serial,
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
      updateData.started_at = new Date();
    } else if (newStatus === 'completed') {
      updateData.completed_at = new Date();
    } else if (newStatus === 'cancelled') {
      updateData.cancelled_at = new Date();
    }

    const updatedAssignment = await prisma.inspection_assignments.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        user_profiles_inspection_assignments_assigned_toTouser_profiles: {
          select: { id: true, full_name: true, role: true }
        },
        user_profiles_inspection_assignments_assigned_byTouser_profiles: {
          select: { id: true, full_name: true, role: true }
        }
      }
    });

    // === Step 7: 감사 로그 기록 (v5.2: equipment-centric pattern) ===
    logger.info('InspectionAssignments:PATCH', 'Assignment status updated successfully', {
      userId: session.user.id,
      role: userProfile.role,
      assignmentId,
      equipmentSerial: assignment.equipment_serial,
      oldStatus: currentStatus,
      newStatus: newStatus,
      timestamp: new Date().toISOString()
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
    logger.error('InspectionAssignments:PATCH', 'API error',
      error instanceof Error ? error : { error }
    );
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

    // 사용자 프로필 조회 (감사 로그용)
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    // 할당 조회 (권한 확인용)
    const assignment = await prisma.inspection_assignments.findUnique({
      where: { id: assignmentId },
      select: { assigned_by: true, status: true, equipment_serial: true }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: '할당을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 본인이 생성한 할당만 삭제 가능
    if (assignment.assigned_by !== session.user.id) {
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

    // === 감사 로그 기록 (v5.2: equipment-centric pattern) ===
    // 삭제 전 equipment 정보 기록
    const aedData = await prisma.aed_data.findUnique({
      where: { equipment_serial: assignment.equipment_serial },
      select: { sido: true, gugun: true }
    });

    // 삭제 (취소 상태로 변경)
    try {
      await prisma.inspection_assignments.update({
        where: { id: assignmentId },
        data: {
          status: 'cancelled',
          cancelled_at: new Date()
        }
      });

      // 감사 로그 기록
      logger.info('InspectionAssignments:DELETE', 'Assignment cancelled successfully', {
        userId: session.user.id,
        role: userProfile?.role || 'unknown',
        assignmentId,
        equipmentSerial: assignment.equipment_serial,
        equipmentSido: aedData?.sido,
        equipmentGugun: aedData?.gugun,
        timestamp: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: '일정이 취소되었습니다.'
      });
    } catch (deleteError) {
      logger.error('InspectionAssignments:DELETE', 'Assignment delete error',
        deleteError instanceof Error ? deleteError : { deleteError }
      );
      return NextResponse.json(
        { error: 'Failed to cancel assignment' },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error('InspectionAssignments:DELETE', 'API error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
