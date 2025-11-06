import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { apiHandler } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';
import { mapCityCodeToGugun } from '@/lib/constants/regions';

import { prisma } from '@/lib/prisma';
/**
 * GET /api/inspections/[id]
 * 점검 이력 상세 조회
 */
// @ts-expect-error - apiHandler type issue with dynamic routes
export const GET = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id: inspectionId } = await params;

  // 인증 확인
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 점검 이력 조회 (inspector와 aed_data 포함)
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
          manufacturer: true
        }
      }
    }
  });

  if (!inspection) {
    return NextResponse.json({ error: 'Inspection record not found' }, { status: 404 });
  }

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
 * 점검 이력 수정 (v5.0)
 *
 * Changes (2025-11-06):
 * - Bug 1: aed_data 로드 + null 처리 추가
 * - Bug 2: canEditInspection 함수 사용, city_code→gugun 매핑
 * - Bug 3: allowedFields snake_case로 통일
 * - Bug 4: updated_at 필드명 수정 (updatedAt → updated_at)
 */
// @ts-expect-error - apiHandler type issue with dynamic routes
export const PATCH = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id: inspectionId } = await params;

  // 인증 확인
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 요청 본문 파싱
  const updates = await request.json();

  // Bug 1 Fix: aed_data를 포함하여 로드 (gugun 필드 필수)
  const inspection = await prisma.inspections.findUnique({
    where: { id: inspectionId },
    select: {
      id: true,
      inspector_id: true,
      aed_data: {
        select: { gugun: true }  // ← 지역 권한 검증용
      }
    }
  });

  if (!inspection) {
    return NextResponse.json({ error: 'Inspection record not found' }, { status: 404 });
  }

  // Bug 1 Fix: aed_data null 체크 (50% 발생률 대비)
  if (!inspection.aed_data) {
    return NextResponse.json(
      {
        error: '점검 기록은 존재하나 장비 정보가 삭제된 상태입니다. 장비 정보가 복구될 때까지 이 기록은 수정할 수 없습니다.',
        code: 'AED_DATA_NOT_FOUND'
      },
      { status: 400 }
    );
  }

  // Bug 2 Fix: profile 쿼리 확대 (city_code 추가)
  const profile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      organizations: {
        select: {
          city_code: true,  // ← 시군구 코드 (v5.0: 검증된 단위)
          region_code: true // ← 참고용
        }
      }
    }
  });

  // Bug 2 Fix: 권한 검증 - city_code → gugun 매핑 (lib/constants/regions.ts 재사용)
  // mapCityCodeToGugun은 null을 반환할 수 있음 (city_code 없을 때)
  const userGugun = mapCityCodeToGugun(profile?.organizations?.city_code);

  // 권한 검증 로직 (v5.0)
  const canEdit = (() => {
    // master, emergency_center_admin: 모든 inspection 수정 가능
    if (['master', 'emergency_center_admin'].includes(profile?.role || '')) {
      return true;
    }

    // ministry_admin: 읽기 전용 (수정 불가)
    if (profile?.role === 'ministry_admin') {
      return false;
    }

    // inspector (본인 기록만 수정)
    if (profile?.role === 'temporary_inspector') {
      return inspection.inspector_id === session.user.id;
    }

    // local_admin: 같은 gugun 내 점검만 수정 (v5.0: 시군구 단위 검증됨)
    // userGugun이 null이면 비교 결과는 false (deny-by-default 안전 처리)
    if (profile?.role === 'local_admin') {
      return userGugun !== null && userGugun === inspection.aed_data.gugun;
    }

    // regional_admin: 같은 region 내 점검만 수정
    if (profile?.role === 'regional_admin') {
      return profile.organizations?.region_code !== undefined;
    }

    return false;
  })();

  if (!canEdit) {
    return NextResponse.json(
      { error: 'You do not have permission to update this inspection' },
      { status: 403 }
    );
  }

  // Bug 3 Fix: allowedFields를 snake_case로 통일 (클라이언트와 일치)
  const allowedFields = [
    'notes',
    'visual_status',        // ← snake_case (InspectionHistory와 일치)
    'battery_status',
    'pad_status',
    'operation_status',
    'overall_status',
    'issues_found',
  ];

  // Bug 4 Fix: updated_at (snake_case) + fieldMapping 제거
  const updateData: any = {
    updated_at: new Date(),  // ← snake_case
  };

  // 클라이언트에서 snake_case로 전송된 필드를 그대로 저장
  Object.keys(updates).forEach((field) => {
    if (allowedFields.includes(field)) {
      updateData[field] = updates[field];  // ← 변환 없이 그대로 저장
    }
  });

  // 업데이트 실행
  try {
    const updatedInspection = await prisma.inspections.update({
      where: { id: inspectionId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: '점검 이력이 수정되었습니다.',
      inspection: updatedInspection,
    });
  } catch (updateError) {
    logger.error('InspectionUpdate:PATCH', 'Update inspection error',
      updateError instanceof Error ? updateError : { updateError }
    );
    return NextResponse.json({ error: 'Failed to update inspection record' }, { status: 500 });
  }
});
