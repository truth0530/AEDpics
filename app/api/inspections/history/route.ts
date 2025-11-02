import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger';

import { prisma } from '@/lib/prisma';
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
      inspector_name: inspection.user_profiles?.full_name || '알 수 없음',
      inspector_email: inspection.user_profiles?.email,
      inspection_date: inspection.inspection_date,
      inspection_type: inspection.inspection_type,
      visual_status: inspection.visual_status,
      battery_status: inspection.battery_status,
      pad_status: inspection.pad_status,
      operation_status: inspection.operation_status,
      overall_status: inspection.overall_status,
      notes: inspection.notes,
      issues_found: inspection.issues_found,
      photos: inspection.photos,
      inspection_latitude: inspection.inspection_latitude,
      inspection_longitude: inspection.inspection_longitude,
      step_data: inspection.inspected_data || {},  // inspected_data를 step_data로 매핑
      original_data: inspection.original_data || {},  // 원본 데이터도 포함
      created_at: inspection.created_at,
      updated_at: inspection.updated_at,
      completed_at: inspection.completed_at,
    }));

    return NextResponse.json({
      success: true,
      count: formattedInspections.length,
      inspections: formattedInspections,
    });

  } catch (error) {
    logger.error('InspectionHistory:GET', 'Query error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json({ error: 'Failed to fetch inspection history' }, { status: 500 });
  }
});
