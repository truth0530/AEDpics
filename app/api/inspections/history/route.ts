import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { apiHandler } from '@/lib/api/error-handler';

/**
 * GET /api/inspections/history
 * 완료된 점검 이력 조회 (최근 24시간 또는 특정 장비)
 */
// @ts-expect-error - apiHandler type issue with return type
export const GET = apiHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const equipmentSerial = searchParams.get('equipment_serial');
  const hoursAgo = parseInt(searchParams.get('hours') || '24');

  // 인증 확인
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 시간 범위 계산
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

  // Prisma 쿼리 조건
  const where: any = {
    inspection_date: {
      gte: cutoffDate
    }
  };

  if (equipmentSerial) {
    where.equipment_serial = equipmentSerial;
  }

  try {
    const inspections = await prisma.inspections.findMany({
      where,
      include: {
        user_profiles: {
          select: {
            full_name: true,
            email: true
          }
        }
      },
      orderBy: {
        inspection_date: 'desc'
      }
    });

    // 응답 데이터 포맷팅
    const formattedInspections = inspections.map((inspection: any) => ({
      id: inspection.id,
      equipment_serial: inspection.equipment_serial,
      inspector_id: inspection.inspector_id,
      inspector_name: inspection.inspector?.fullName || '알 수 없음',
      inspector_email: inspection.inspector?.email,
      inspection_date: inspection.inspection_date,
      inspection_type: inspection.inspectionType,
      visual_status: inspection.visualStatus,
      battery_status: inspection.batteryStatus,
      pad_status: inspection.padStatus,
      operation_status: inspection.operationStatus,
      overall_status: inspection.overallStatus,
      notes: inspection.notes,
      issues_found: inspection.issuesFound,
      photos: inspection.photos,
      inspection_latitude: inspection.inspectionLatitude,
      inspection_longitude: inspection.inspectionLongitude,
      step_data: inspection.stepData,
      created_at: inspection.createdAt,
      updated_at: inspection.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      count: formattedInspections.length,
      inspections: formattedInspections,
    });

  } catch (error) {
    console.error('[Inspection History] Query error:', error);
    return NextResponse.json({ error: 'Failed to fetch inspection history' }, { status: 500 });
  }
});
