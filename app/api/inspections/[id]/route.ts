import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { apiHandler } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
import { resolveAccessScope } from '@/lib/auth/access-control';
import { canAccessEquipment } from '@/lib/auth/equipment-access';

/**
 * GET /api/inspections/[id]
 * 점검 이력 상세 조회 (v5.2 - Equipment-Centric Access Control)
 *
 * v5.2 Changes:
 * - resolveAccessScope()로 사용자 권한 범위 계산
 * - canAccessEquipment()로 equipment 접근 권한 검증
 * - 권한 없을 시 403 반환 (보안 강화)
 * - 감사 로그 추가 (access denied 케이스)
 */
// @ts-expect-error - apiHandler type issue with dynamic routes
export const GET = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id: inspectionId } = await params;

  // === Step 1: 인증 확인 ===
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // === Step 2: 사용자 프로필 조회 ===
  const userProfile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id }
  });

  if (!userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  // === Step 3: 점검 이력 조회 (inspector와 aed_data 포함) ===
  const inspection = await prisma.inspections.findUnique({
    where: { id: inspectionId },
    include: {
      user_profiles: {
        select: {
          full_name: true,
          email: true
        }
      },
      aed_data: {
        select: {
          equipment_serial: true,
          installation_institution: true,
          installation_address: true,
          model_name: true,
          manufacturer: true,
          sido: true,
          gugun: true,
          jurisdiction_health_center: true
        }
      }
    }
  });

  if (!inspection) {
    return NextResponse.json({ error: 'Inspection record not found' }, { status: 404 });
  }

  // === Step 4: 권한 범위 계산 ===
  const accessScope = resolveAccessScope(userProfile as any);

  // === Step 5: Equipment 접근 권한 검증 ===
  const canAccess = canAccessEquipment(
    {
      equipment_serial: inspection.equipment_serial,
      sido: inspection.aed_data?.sido || null,
      gugun: inspection.aed_data?.gugun || null,
      jurisdiction_health_center: inspection.aed_data?.jurisdiction_health_center || null
    },
    accessScope,
    'address'
  );

  if (!canAccess) {
    logger.warn('InspectionDetail:GET', 'Equipment access denied', {
      userId: session.user.id,
      role: userProfile.role,
      inspectionId,
      equipmentSerial: inspection.equipment_serial,
      equipmentSido: inspection.aed_data?.sido,
      equipmentGugun: inspection.aed_data?.gugun
    });

    return NextResponse.json(
      { error: 'You do not have permission to view this inspection' },
      { status: 403 }
    );
  }

  // === Step 6: 감사 로그 ===
  logger.info('InspectionDetail:GET', 'Inspection detail retrieved', {
    userId: session.user.id,
    role: userProfile.role,
    inspectionId,
    equipmentSerial: inspection.equipment_serial
  });

  return NextResponse.json({
    success: true,
    inspection: {
      ...inspection,
      inspector_name: inspection.user_profiles?.full_name || '알 수 없음',
      inspector_email: inspection.user_profiles?.email,
      device_info: inspection.aed_data,
    },
  });
});

/**
 * PATCH /api/inspections/[id]
 * 점검 이력 수정 (v5.2 - Equipment-Centric Access Control)
 *
 * v5.2 Changes:
 * - canAccessEquipment()를 사용한 통합 권한 검증
 * - resolveAccessScope()로 일관된 권한 범위 계산
 * - legacy mapCityCodeToGugun 제거, equipment-access.ts 패턴 적용
 * - 감사 로그 추가 (access denied 케이스)
 *
 * Previous changes (v5.0):
 * - Bug 1: aed_data 로드 + null 처리 추가
 * - Bug 2: canEditInspection 함수 사용, city_code→gugun 매핑
 * - Bug 3: allowedFields snake_case로 통일
 * - Bug 4: updated_at 필드명 수정 (updatedAt → updated_at)
 */
// @ts-expect-error - apiHandler type issue with dynamic routes
export const PATCH = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id: inspectionId } = await params;

  // === Step 1: 인증 확인 ===
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // === Step 2: 요청 본문 파싱 ===
  const updates = await request.json();

  // === Step 3: 사용자 프로필 조회 ===
  const userProfile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id }
  });

  if (!userProfile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
  }

  // === Step 4: 점검 이력 조회 (equipment 권한 검증용 필드 포함) ===
  const inspection = await prisma.inspections.findUnique({
    where: { id: inspectionId },
    select: {
      id: true,
      inspector_id: true,
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

  if (!inspection) {
    return NextResponse.json({ error: 'Inspection record not found' }, { status: 404 });
  }

  // === Step 5: aed_data null 체크 ===
  if (!inspection.aed_data) {
    return NextResponse.json(
      {
        error: '점검 기록은 존재하나 장비 정보가 삭제된 상태입니다. 장비 정보가 복구될 때까지 이 기록은 수정할 수 없습니다.',
        code: 'AED_DATA_NOT_FOUND'
      },
      { status: 400 }
    );
  }

  // === Step 6: 권한 범위 계산 ===
  const accessScope = resolveAccessScope(userProfile as any);

  // === Step 7: Equipment 접근 권한 검증 ===
  const canAccess = canAccessEquipment(
    {
      equipment_serial: inspection.equipment_serial,
      sido: inspection.aed_data.sido || null,
      gugun: inspection.aed_data.gugun || null,
      jurisdiction_health_center: inspection.aed_data.jurisdiction_health_center || null
    },
    accessScope,
    'address'
  );

  if (!canAccess) {
    logger.warn('InspectionDetail:PATCH', 'Equipment access denied', {
      userId: session.user.id,
      role: userProfile.role,
      inspectionId,
      equipmentSerial: inspection.equipment_serial,
      equipmentSido: inspection.aed_data.sido,
      equipmentGugun: inspection.aed_data.gugun
    });

    return NextResponse.json(
      { error: 'You do not have permission to update this inspection' },
      { status: 403 }
    );
  }

  // === Step 8: 역할별 추가 권한 검증 (temporary_inspector: 본인 기록만) ===
  if (userProfile.role === 'temporary_inspector') {
    if (inspection.inspector_id !== session.user.id) {
      logger.warn('InspectionDetail:PATCH', 'Inspector cannot edit others records', {
        userId: session.user.id,
        targetInspectorId: inspection.inspector_id,
        inspectionId
      });

      return NextResponse.json(
        { error: 'You can only edit your own inspection records' },
        { status: 403 }
      );
    }
  }

  // === Step 9: ministry_admin 읽기 전용 체크 ===
  if (userProfile.role === 'ministry_admin') {
    logger.warn('InspectionDetail:PATCH', 'Ministry admin cannot edit inspections', {
      userId: session.user.id,
      inspectionId
    });

    return NextResponse.json(
      { error: 'Ministry admin accounts cannot edit inspection records' },
      { status: 403 }
    );
  }

  // === Step 10: 허용 필드 정의 ===
  const allowedFields = [
    'notes',
    'visual_status',
    'battery_status',
    'pad_status',
    'operation_status',
    'overall_status',
    'issues_found',
  ];

  // === Step 11: 업데이트 데이터 구성 ===
  const updateData: any = {
    updated_at: new Date(),
  };

  Object.keys(updates).forEach((field) => {
    if (allowedFields.includes(field)) {
      updateData[field] = updates[field];
    }
  });

  // === Step 12: 업데이트 실행 ===
  try {
    const updatedInspection = await prisma.inspections.update({
      where: { id: inspectionId },
      data: updateData
    });

    logger.info('InspectionDetail:PATCH', 'Inspection updated successfully', {
      userId: session.user.id,
      role: userProfile.role,
      inspectionId,
      equipmentSerial: inspection.equipment_serial,
      fieldsUpdated: Object.keys(updateData).length
    });

    return NextResponse.json({
      success: true,
      message: '점검 이력이 수정되었습니다.',
      inspection: updatedInspection,
    });
  } catch (updateError) {
    logger.error('InspectionDetail:PATCH', 'Update inspection error',
      updateError instanceof Error ? updateError : { updateError }
    );
    return NextResponse.json({ error: 'Failed to update inspection record' }, { status: 500 });
  }
});
