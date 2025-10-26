import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { canPerformInspection, canAccessDevice, AccessContext } from '@/lib/auth/access-control';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isFeatureEnabled('quickInspect')) {
      return NextResponse.json({ error: 'Quick inspect feature is currently disabled.' }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const deviceId: string | undefined = payload?.deviceId;

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    const profile = await prisma.userProfile.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        assignedDevices: true,
        organizationId: true
      }
    });

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }

    // account_type 컬럼이 존재하지 않으므로 기본값 'public' 사용
    const accessContext: AccessContext = {
      userId: profile.id,
      role: profile.role,
      accountType: 'public',
      assignedDevices: profile.assignedDevices || [],
      organizationId: profile.organizationId || undefined,
    };

    console.log('[Quick Inspection] User context:', {
      role: profile.role,
      accountType: 'public (default)',
      resolvedAccountType: accessContext.accountType,
    });

    if (!canPerformInspection(accessContext)) {
      console.log('[Quick Inspection] Permission denied for context:', accessContext);
      return NextResponse.json({ error: 'Inspection not permitted for this user' }, { status: 403 });
    }

    // aed_data 테이블에서 device 확인
    // deviceId는 equipment_serial 또는 id를 사용할 수 있음
    const deviceIdAsNumber = parseInt(deviceId, 10);
    const device = await prisma.aedData.findFirst({
      where: {
        OR: [
          ...(isNaN(deviceIdAsNumber) ? [] : [{ id: deviceIdAsNumber }]),
          { equipmentSerial: deviceId }
        ]
      },
      select: {
        id: true,
        equipmentSerial: true
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
      const inspection = await prisma.inspection.create({
        data: {
          aedDataId: device.id,
          equipmentSerial: device.equipmentSerial,
          inspectorId: session.user.id,
          inspectionType: 'special',
          overallStatus: 'pending',
        },
        select: {
          id: true,
          inspectionDate: true,
          overallStatus: true
        }
      });

      return NextResponse.json({
        inspectionId: inspection.id,
        inspectionDate: inspection.inspectionDate,
        status: inspection.overallStatus,
      });

    } catch (insertError) {
      console.error('Failed to insert quick inspection:', insertError);
      return NextResponse.json({ error: 'Failed to create inspection record' }, { status: 500 });
    }
  } catch (error) {
    console.error('Quick inspection API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
