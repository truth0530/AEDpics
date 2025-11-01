import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { canPerformInspection, canAccessDevice, AccessContext } from '@/lib/auth/access-control';
import { requireAuthWithProfile, isErrorResponse } from '@/lib/auth/session-helpers';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // 인증 및 프로필 조회 (헬퍼 함수 사용)
    const authResult = await requireAuthWithProfile({
      id: true,
      role: true,
      assigned_devices: true,
      organization_id: true,
    });

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { session, profile } = authResult;

    if (!isFeatureEnabled('quickInspect')) {
      return NextResponse.json({ error: 'Quick inspect feature is currently disabled.' }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const deviceId: string | undefined = payload?.deviceId;

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    // account_type 컬럼이 존재하지 않으므로 기본값 'public' 사용
    const accessContext: AccessContext = {
      userId: profile.id,
      role: profile.role,
      accountType: 'public',
      assignedDevices: profile.assigned_devices || [],
      organizationId: profile.organization_id || undefined,
    };

    logger.info('QuickInspection:POST', 'User context', {
      role: profile.role,
      accountType: 'public (default)',
      resolvedAccountType: accessContext.accountType,
    });

    if (!canPerformInspection(accessContext)) {
      logger.warn('QuickInspection:POST', 'Permission denied', { accessContext });
      return NextResponse.json({ error: 'Inspection not permitted for this user' }, { status: 403 });
    }

    // aed_data 테이블에서 device 확인
    // deviceId는 equipment_serial 또는 id를 사용할 수 있음
    const deviceIdAsNumber = parseInt(deviceId, 10);
    const device = await prisma.aed_data.findFirst({
      where: {
        OR: [
          ...(isNaN(deviceIdAsNumber) ? [] : [{ id: deviceIdAsNumber }]),
          { equipment_serial: deviceId }
        ]
      },
      select: {
        id: true,
        equipment_serial: true
      }
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found or inaccessible' }, { status: 404 });
    }

    if (!canAccessDevice(accessContext, deviceId)) {
      return NextResponse.json({ error: 'User cannot access this device' }, { status: 403 });
    }

    // inspections 테이블 사용
    try {
      const inspection = await prisma.inspections.create({
        data: {
          aed_data_id: device.id,
          equipment_serial: device.equipment_serial,
          inspector_id: session.user.id,
          inspection_type: 'special',
          overall_status: 'pending',
        },
        select: {
          id: true,
          inspection_date: true,
          overall_status: true
        }
      });

      return NextResponse.json({
        inspectionId: inspection.id,
        inspection_date: inspection.inspection_date,
        status: inspection.overall_status,
      });

    } catch (insertError) {
      logger.error('QuickInspection:POST', 'Failed to insert quick inspection',
        insertError instanceof Error ? insertError : { insertError }
      );
      return NextResponse.json({ error: 'Failed to create inspection record' }, { status: 500 });
    }
  } catch (error) {
    logger.error('QuickInspection:POST', 'Quick inspection API error',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
