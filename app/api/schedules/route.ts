import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { buildScheduledTimestamp, isValidAssigneeIdentifier } from '@/lib/utils/schedule';
import { prisma } from '@/lib/prisma';
import { resolveAccessScope } from '@/lib/auth/access-control';
import { canAccessEquipment } from '@/lib/auth/equipment-access';
import { logger } from '@/lib/logger';

interface SchedulePayload {
  deviceId?: string;
  scheduledDate?: string;
  scheduledTime?: string | null;
  assignee?: string;
  priority?: string;
  notes?: string | null;
}

/**
 * POST /api/schedules
 * 점검 스케줄 생성 (v5.2 - Equipment-Centric Access Control)
 *
 * v5.2 Changes:
 * - resolveAccessScope()로 사용자 권한 범위 계산
 * - canAccessEquipment()로 equipment 접근 권한 검증
 * - temporary_inspector 역할 게이트 추가
 * - 감사 로그 추가 (equipment location 포함)
 * - 응답 형식 통일: { success: true, data: schedule, message }
 */
export async function POST(request: NextRequest) {
  try {
    // === Step 1: 인증 확인 ===
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // === Step 2: 사용자 프로필 조회 ===
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        region_code: true,
        region: true,
        district: true,
        email: true,
        organization_name: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // === Step 3: Feature flag 확인 ===
    if (!isFeatureEnabled('schedule')) {
      return NextResponse.json({ error: 'Scheduling feature is currently disabled.' }, { status: 403 });
    }

    // === Step 4: 요청 본문 파싱 ===
    const payload = (await request.json().catch(() => null)) as SchedulePayload | null;

    if (!payload?.deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    if (!payload.scheduledDate) {
      return NextResponse.json({ error: 'scheduledDate is required' }, { status: 400 });
    }

    if (!payload.assignee || !isValidAssigneeIdentifier(payload.assignee)) {
      return NextResponse.json({ error: 'assignee is invalid' }, { status: 400 });
    }

    const scheduledFor = buildScheduledTimestamp(payload.scheduledDate, payload.scheduledTime ?? undefined);

    if (!scheduledFor) {
      return NextResponse.json({ error: 'Invalid scheduled date or time' }, { status: 400 });
    }

    // === Step 5: Temporary Inspector 역할 게이트 ===
    if (userProfile.role === 'temporary_inspector') {
      logger.warn('ScheduleCreation:POST', 'temporary_inspector role not allowed', {
        userId: session.user.id
      });

      return NextResponse.json(
        { error: 'Temporary inspectors cannot create schedules' },
        { status: 403 }
      );
    }

    // === Step 6: 권한 범위 계산 ===
    const accessScope = resolveAccessScope(userProfile as any);

    // === Step 7: Equipment 조회 및 접근 권한 검증 ===
    // deviceId는 equipment_serial 또는 id를 사용할 수 있음
    const deviceIdNum = parseInt(payload.deviceId);
    const aedData = await prisma.aed_data.findFirst({
      where: {
        OR: [
          { id: isNaN(deviceIdNum) ? undefined : deviceIdNum },
          { equipment_serial: payload.deviceId },
        ],
      },
      select: {
        id: true,
        equipment_serial: true,
        sido: true,
        gugun: true,
        jurisdiction_health_center: true
      },
    });

    if (!aedData) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // === Step 8: Equipment 접근 권한 검증 (v5.2: equipment-centric pattern) ===
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
      logger.warn('ScheduleCreation:POST', 'Equipment access denied', {
        userId: session.user.id,
        role: userProfile.role,
        equipmentSerial: aedData.equipment_serial,
        equipmentSido: aedData.sido,
        equipmentGugun: aedData.gugun
      });

      return NextResponse.json(
        { error: 'You do not have permission to create schedule for this equipment' },
        { status: 403 }
      );
    }

    // === Step 9-10: 트랜잭션 내에서 중복 체크 및 스케줄 생성 (Race Condition 방지) ===
    // 시간 범위 기반 중복 체크와 스케줄 생성을 원자적(atomic)으로 처리
    const windowStart = new Date(scheduledFor);
    windowStart.setMinutes(windowStart.getMinutes() - 30);
    const windowEnd = new Date(scheduledFor);
    windowEnd.setMinutes(windowEnd.getMinutes() + 30);

    let schedule;
    try {
      schedule = await prisma.$transaction(async (tx) => {
        // 트랜잭션 내에서 중복 체크
        const duplicateCheck = await tx.inspection_schedules.findFirst({
          where: {
            aed_data_id: aedData.id,
            scheduled_for: {
              gte: windowStart,
              lt: windowEnd,
            },
          },
          select: { id: true },
        });

        // 중복이 있으면 에러 발생 (트랜잭션 롤백)
        if (duplicateCheck) {
          throw new Error(
            `SCHEDULE_CONFLICT|A schedule already exists near the selected time for this device|${duplicateCheck.id}`
          );
        }

        // 중복이 없으면 스케줄 생성
        const newSchedule = await tx.inspection_schedules.create({
          data: {
            aed_data_id: aedData.id,
            equipment_serial: aedData.equipment_serial,
            scheduled_for: new Date(scheduledFor),
            assignee_identifier: payload.assignee,
            priority: payload.priority || 'normal',
            notes: payload.notes,
            created_by: session.user.id,
          },
          select: {
            id: true,
            equipment_serial: true,
            scheduled_for: true,
            priority: true,
            status: true,
          },
        });

        return newSchedule;
      });
    } catch (error: any) {
      // SCHEDULE_CONFLICT 에러 처리
      if (error.message?.startsWith('SCHEDULE_CONFLICT|')) {
        const [, errorMessage] = error.message.split('|');
        logger.warn('ScheduleCreation:POST', 'Schedule creation blocked - duplicate found', {
          userId: session.user.id,
          equipmentSerial: aedData.equipment_serial,
          scheduledFor: scheduledFor
        });

        return NextResponse.json(
          { error: errorMessage },
          { status: 409 }
        );
      }

      // 다른 에러는 상위 catch로 전파
      throw error;
    }

    // === Step 11: 감사 로그 ===
    logger.info('ScheduleCreation:POST', 'Schedule created successfully', {
      userId: session.user.id,
      email: userProfile.email,
      role: userProfile.role,
      scheduleId: schedule.id,
      equipmentSerial: aedData.equipment_serial,
      equipmentSido: aedData.sido,
      equipmentGugun: aedData.gugun,
      scheduledFor: schedule.scheduled_for,
      timestamp: new Date().toISOString()
    });

    // === Step 12: 응답 전송 ===
    return NextResponse.json({
      success: true,
      data: schedule,
      message: 'Schedule created successfully'
    });
  } catch (error) {
    logger.error('ScheduleCreation:POST', 'Schedule creation error',
      error instanceof Error ? error : { error }
    );

    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/schedules
 * 스케줄 목록 조회 (v5.2 - Equipment-Centric Access Control)
 *
 * v5.2 Changes:
 * - resolveAccessScope()로 사용자 권한 범위 계산
 * - buildEquipmentFilter()로 equipment FK 기반 필터링
 * - aed_data 관계를 통한 equipment access 제어
 * - 감사 로그 추가
 */
export async function GET(request: NextRequest) {
  try {
    // === Step 1: 인증 확인 ===
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // === Step 2: 사용자 프로필 조회 ===
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        region_code: true,
        region: true,
        district: true,
        email: true,
        organization_name: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // === Step 3: Feature flag 확인 ===
    if (!isFeatureEnabled('schedule')) {
      return NextResponse.json({ error: 'Scheduling feature is currently disabled.' }, { status: 403 });
    }

    // === Step 4: Temporary Inspector 역할 게이트 ===
    if (userProfile.role === 'temporary_inspector') {
      logger.warn('ScheduleList:GET', 'temporary_inspector role not allowed', {
        userId: session.user.id
      });

      return NextResponse.json(
        { error: 'Temporary inspectors cannot view schedules' },
        { status: 403 }
      );
    }

    // === Step 5: 권한 범위 계산 ===
    const accessScope = resolveAccessScope(userProfile as any);

    // === Step 6: Equipment FK 기반 필터링 ===
    // Master admin: 제한 없음
    // Regional/Local admin: 권한 범위 내 equipment만 조회
    const searchParams = request.nextUrl.searchParams;
    const criteria = searchParams.get('criteria') || 'address';
    const whereClause: any = {};

    if (accessScope.allowedRegionCodes !== null) {
      // Master admin이 아닌 경우 equipment 필터링 필요
      const { buildEquipmentFilter } = await import('@/lib/auth/equipment-access');
      const equipmentFilter = buildEquipmentFilter(accessScope, criteria as 'address' | 'jurisdiction');

      if (Object.keys(equipmentFilter).length > 0) {
        whereClause.aed_data = equipmentFilter;
      } else if (accessScope.allowedRegionCodes.length === 0) {
        // 접근 차단된 경우
        return NextResponse.json({
          success: true,
          data: [],
          message: 'No accessible schedules'
        });
      }
    }

    // === Step 7: 스케줄 목록 조회 ===
    const schedules = await prisma.inspection_schedules.findMany({
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
      include: {
        aed_data: {
          select: {
            equipment_serial: true,
            sido: true,
            gugun: true,
            installation_address: true
          }
        },
        user_profiles: {
          select: {
            full_name: true,
            email: true
          }
        }
      },
      orderBy: {
        scheduled_for: 'desc'
      },
      take: 100
    });

    // === Step 8: 감사 로그 ===
    logger.info('ScheduleList:GET', 'Schedule list retrieved', {
      userId: session.user.id,
      email: userProfile.email,
      role: userProfile.role,
      recordCount: schedules.length,
      timestamp: new Date().toISOString()
    });

    // === Step 9: 응답 전송 ===
    return NextResponse.json({
      success: true,
      data: schedules,
      message: 'Schedule list retrieved successfully'
    });
  } catch (error) {
    logger.error('ScheduleList:GET', 'Schedule list retrieval error',
      error instanceof Error ? error : { error }
    );

    return NextResponse.json(
      { error: 'Failed to retrieve schedules' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/schedules/[id]
 * 스케줄 수정 (v5.2 - Equipment-Centric Access Control)
 *
 * v5.2 Changes:
 * - resolveAccessScope()로 사용자 권한 범위 계산
 * - canAccessEquipment()로 equipment 접근 권한 검증
 * - temporary_inspector 역할 게이트 추가
 * - 감사 로그 추가 (equipment location 포함)
 */
export async function PATCH(request: NextRequest) {
  try {
    // === Step 1: 인증 확인 ===
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // === Step 2: 요청 본문 파싱 ===
    const updates = await request.json();
    const scheduleId = updates.id;

    if (!scheduleId) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    // === Step 3: 사용자 프로필 조회 ===
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        region_code: true,
        region: true,
        district: true,
        email: true,
        organization_name: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // === Step 4: Feature flag 확인 ===
    if (!isFeatureEnabled('schedule')) {
      return NextResponse.json({ error: 'Scheduling feature is currently disabled.' }, { status: 403 });
    }

    // === Step 5: Temporary Inspector 역할 게이트 ===
    if (userProfile.role === 'temporary_inspector') {
      logger.warn('ScheduleUpdate:PATCH', 'temporary_inspector role not allowed', {
        userId: session.user.id
      });

      return NextResponse.json(
        { error: 'Temporary inspectors cannot modify schedules' },
        { status: 403 }
      );
    }

    // === Step 6: 스케줄 조회 (equipment 접근 권한 검증용) ===
    const schedule = await prisma.inspection_schedules.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        aed_data_id: true,
        equipment_serial: true,
        aed_data: {
          select: {
            equipment_serial: true,
            sido: true,
            gugun: true,
            jurisdiction_health_center: true
          }
        }
      }
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // === Step 7: 권한 범위 계산 ===
    const accessScope = resolveAccessScope(userProfile as any);

    // === Step 8: Equipment 접근 권한 검증 ===
    if (schedule.aed_data) {
      const canAccess = canAccessEquipment(
        {
          equipment_serial: schedule.aed_data.equipment_serial,
          sido: schedule.aed_data.sido || null,
          gugun: schedule.aed_data.gugun || null,
          jurisdiction_health_center: schedule.aed_data.jurisdiction_health_center || null
        },
        accessScope,
        'address'
      );

      if (!canAccess) {
        logger.warn('ScheduleUpdate:PATCH', 'Equipment access denied', {
          userId: session.user.id,
          role: userProfile.role,
          scheduleId,
          equipmentSerial: schedule.aed_data.equipment_serial,
          equipmentSido: schedule.aed_data.sido,
          equipmentGugun: schedule.aed_data.gugun
        });

        return NextResponse.json(
          { error: 'You do not have permission to modify this schedule' },
          { status: 403 }
        );
      }
    }

    // === Step 9: 허용 필드 정의 ===
    const allowedFields = [
      'priority',
      'notes',
      'status',
      'assignee_identifier',
      'scheduled_for'
    ];

    // === Step 10: 업데이트 데이터 구성 ===
    const updateData: any = {
      updated_at: new Date(),
    };

    Object.keys(updates).forEach((field) => {
      if (allowedFields.includes(field) && field !== 'id') {
        updateData[field] = updates[field];
      }
    });

    // === Step 11: 스케줄 수정 ===
    const updatedSchedule = await prisma.inspection_schedules.update({
      where: { id: scheduleId },
      data: updateData,
      select: {
        id: true,
        equipment_serial: true,
        scheduled_for: true,
        priority: true,
        status: true,
        notes: true
      }
    });

    // === Step 12: 감사 로그 ===
    logger.info('ScheduleUpdate:PATCH', 'Schedule updated successfully', {
      userId: session.user.id,
      email: userProfile.email,
      role: userProfile.role,
      scheduleId,
      equipmentSerial: schedule.aed_data?.equipment_serial,
      equipmentSido: schedule.aed_data?.sido,
      equipmentGugun: schedule.aed_data?.gugun,
      fieldsUpdated: Object.keys(updateData).length,
      timestamp: new Date().toISOString()
    });

    // === Step 13: 응답 전송 ===
    return NextResponse.json({
      success: true,
      data: updatedSchedule,
      message: 'Schedule updated successfully'
    });
  } catch (error) {
    logger.error('ScheduleUpdate:PATCH', 'Schedule update error',
      error instanceof Error ? error : { error }
    );

    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/schedules/[id]
 * 스케줄 삭제 (v5.2 - Equipment-Centric Access Control)
 *
 * v5.2 Changes:
 * - resolveAccessScope()로 사용자 권한 범위 계산
 * - canAccessEquipment()로 equipment 접근 권한 검증
 * - temporary_inspector 역할 게이트 추가
 * - 감사 로그 추가 (equipment location 포함)
 */
export async function DELETE(request: NextRequest) {
  try {
    // === Step 1: 인증 확인 ===
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // === Step 2: 스케줄 ID 추출 (URL에서 읽어야 함) ===
    // Note: DELETE 요청의 body에서 scheduleId 읽기
    let scheduleId: string | null = null;

    try {
      const body = await request.json();
      scheduleId = body.id;
    } catch (e) {
      // JSON parse 실패 시 query param에서 읽기
      scheduleId = request.nextUrl.searchParams.get('id');
    }

    if (!scheduleId) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    // === Step 3: 사용자 프로필 조회 ===
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        region_code: true,
        region: true,
        district: true,
        email: true,
        organization_name: true
      }
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // === Step 4: Feature flag 확인 ===
    if (!isFeatureEnabled('schedule')) {
      return NextResponse.json({ error: 'Scheduling feature is currently disabled.' }, { status: 403 });
    }

    // === Step 5: Temporary Inspector 역할 게이트 ===
    if (userProfile.role === 'temporary_inspector') {
      logger.warn('ScheduleDeletion:DELETE', 'temporary_inspector role not allowed', {
        userId: session.user.id
      });

      return NextResponse.json(
        { error: 'Temporary inspectors cannot delete schedules' },
        { status: 403 }
      );
    }

    // === Step 6: 스케줄 조회 (equipment 접근 권한 검증용) ===
    const schedule = await prisma.inspection_schedules.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        equipment_serial: true,
        aed_data: {
          select: {
            equipment_serial: true,
            sido: true,
            gugun: true,
            jurisdiction_health_center: true
          }
        }
      }
    });

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // === Step 7: 권한 범위 계산 ===
    const accessScope = resolveAccessScope(userProfile as any);

    // === Step 8: Equipment 접근 권한 검증 ===
    if (schedule.aed_data) {
      const canAccess = canAccessEquipment(
        {
          equipment_serial: schedule.aed_data.equipment_serial,
          sido: schedule.aed_data.sido || null,
          gugun: schedule.aed_data.gugun || null,
          jurisdiction_health_center: schedule.aed_data.jurisdiction_health_center || null
        },
        accessScope,
        'address'
      );

      if (!canAccess) {
        logger.warn('ScheduleDeletion:DELETE', 'Equipment access denied', {
          userId: session.user.id,
          role: userProfile.role,
          scheduleId,
          equipmentSerial: schedule.aed_data.equipment_serial,
          equipmentSido: schedule.aed_data.sido,
          equipmentGugun: schedule.aed_data.gugun
        });

        return NextResponse.json(
          { error: 'You do not have permission to delete this schedule' },
          { status: 403 }
        );
      }
    }

    // === Step 9: 스케줄 삭제 ===
    const deletedSchedule = await prisma.inspection_schedules.delete({
      where: { id: scheduleId },
      select: {
        id: true,
        equipment_serial: true,
        scheduled_for: true
      }
    });

    // === Step 10: 감사 로그 ===
    logger.info('ScheduleDeletion:DELETE', 'Schedule deleted successfully', {
      userId: session.user.id,
      email: userProfile.email,
      role: userProfile.role,
      scheduleId,
      equipmentSerial: schedule.aed_data?.equipment_serial,
      equipmentSido: schedule.aed_data?.sido,
      equipmentGugun: schedule.aed_data?.gugun,
      timestamp: new Date().toISOString()
    });

    // === Step 11: 응답 전송 ===
    return NextResponse.json({
      success: true,
      data: deletedSchedule,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    logger.error('ScheduleDeletion:DELETE', 'Schedule deletion error',
      error instanceof Error ? error : { error }
    );

    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
