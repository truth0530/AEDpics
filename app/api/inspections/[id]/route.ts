import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { apiHandler } from '@/lib/api/error-handler';

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
 * 점검 이력 수정
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

  // 점검 이력 조회 (권한 확인)
  const inspection = await prisma.inspections.findUnique({
    where: { id: inspectionId },
    select: {
      id: true,
      inspector_id: true
    }
  });

  if (!inspection) {
    return NextResponse.json({ error: 'Inspection record not found' }, { status: 404 });
  }

  // 권한 확인: 본인만 수정 가능 (또는 관리자)
  const profile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  const isAdmin = profile?.role && ['master', 'emergency_center_admin', 'ministry_admin'].includes(profile.role);
  const isOwner = inspection.inspector_id === session.user.id;

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'You do not have permission to update this inspection' }, { status: 403 });
  }

  // 수정 가능한 필드만 업데이트
  const allowedFields = [
    'notes',
    'visualStatus',
    'batteryStatus',
    'padStatus',
    'operationStatus',
    'overallStatus',
    'issuesFound',
  ];

  const updateData: any = {
    updatedAt: new Date(),
  };

  // snake_case에서 camelCase로 변환된 필드 매핑
  const fieldMapping: Record<string, string> = {
    'notes': 'notes',
    'visual_status': 'visualStatus',
    'battery_status': 'batteryStatus',
    'pad_status': 'padStatus',
    'operation_status': 'operationStatus',
    'overall_status': 'overallStatus',
    'issues_found': 'issuesFound',
  };

  Object.keys(updates).forEach((field) => {
    const camelField = fieldMapping[field] || field;
    if (allowedFields.includes(camelField)) {
      updateData[camelField] = updates[field];
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
    console.error('[Update Inspection] Error:', updateError);
    return NextResponse.json({ error: 'Failed to update inspection record' }, { status: 500 });
  }
});
