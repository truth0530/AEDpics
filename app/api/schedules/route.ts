import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isFeatureEnabled } from '@/lib/config/feature-flags';
import { buildScheduledTimestamp, isValidAssigneeIdentifier } from '@/lib/utils/schedule';
import { AccessContext, canAccessDevice, canManageSchedules } from '@/lib/auth/access-control';

const prisma = new PrismaClient();

interface SchedulePayload {
  deviceId?: string;
  scheduledDate?: string;
  scheduledTime?: string | null;
  assignee?: string;
  priority?: string;
  notes?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isFeatureEnabled('schedule')) {
      return NextResponse.json({ error: 'Scheduling feature is currently disabled.' }, { status: 403 });
    }

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

    const profile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        account_type: true,
        assigned_devices: true,
        organization_id: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 403 });
    }

    const accessContext: AccessContext = {
      userId: profile.id,
      role: profile.role,
      accountType: (profile.account_type as 'public' | 'temporary') || 'public',
      assignedDevices: profile.assigned_devices || [],
      organizationId: profile.organization_id || undefined,
    };

    if (accessContext.accountType !== 'public' || !canManageSchedules(accessContext.role)) {
      return NextResponse.json({ error: 'Scheduling not permitted for this user' }, { status: 403 });
    }

    // aed_data 테이블에서 device 확인
    // deviceId는 equipment_serial 또는 id를 사용할 수 있음
    const deviceIdNum = parseInt(payload.deviceId);
    const device = await prisma.aed_data.findFirst({
      where: {
        OR: [
          { id: isNaN(deviceIdNum) ? undefined : deviceIdNum },
          { equipment_serial: payload.deviceId },
        ],
      },
      select: {
        id: true,
        equipment_serial: true,
      },
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found or inaccessible' }, { status: 404 });
    }

    if (!canAccessDevice(accessContext, payload.deviceId)) {
      return NextResponse.json({ error: 'User cannot access this device' }, { status: 403 });
    }

    const windowStart = new Date(scheduledFor);
    windowStart.setMinutes(windowStart.getMinutes() - 30);
    const windowEnd = new Date(scheduledFor);
    windowEnd.setMinutes(windowEnd.getMinutes() + 30);

    // inspection_schedules 테이블에서 중복 체크
    const duplicateCheck = await prisma.inspection_schedules.findFirst({
      where: {
        aed_data_id: device.id,
        scheduled_for: {
          gte: windowStart,
          lt: windowEnd,
        },
      },
      select: { id: true },
    });

    if (duplicateCheck) {
      return NextResponse.json({ error: 'A schedule already exists near the selected time for this device' }, { status: 409 });
    }

    // inspection_schedules 테이블 사용
    try {
      const data = await prisma.inspection_schedules.create({
        data: {
          aed_data_id: device.id,  // aed_data의 실제 id 사용 (INTEGER)
          equipment_serial: device.equipment_serial,  // 장비 시리얼도 저장
          scheduled_for: new Date(scheduledFor),
          assignee_identifier: payload.assignee,
          priority: payload.priority || 'normal',
          notes: payload.notes,
          created_by: session.user.id,
        },
        select: {
          id: true,
          scheduled_for: true,
          priority: true,
          status: true,
        },
      });

      return NextResponse.json({
        id: data.id,
        scheduledFor: data.scheduled_for,
        priority: data.priority,
        status: data.status,
      });
    } catch (insertError) {
      console.error('Failed to create schedule entry:', insertError);
      return NextResponse.json({ error: 'Failed to create schedule entry' }, { status: 500 });
    }
  } catch (error) {
    console.error('Schedule API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
