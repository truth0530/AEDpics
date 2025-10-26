import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.user_profiles.findUnique({
    where: { id: session.user.id },
    select: { role: true, assigned_devices: true }
  });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // 역할 검증 - temporary_inspector만 이 엔드포인트 사용 가능
  if (profile.role !== 'temporary_inspector') {
    return NextResponse.json(
      { error: 'This endpoint is for temporary inspectors only' },
      { status: 403 }
    );
  }

  // 할당된 장비가 없는 경우
  if (!profile.assigned_devices || !Array.isArray(profile.assigned_devices) || profile.assigned_devices.length === 0) {
    return NextResponse.json({
      devices: [],
      count: 0,
      message: 'No devices assigned'
    });
  }

  // 할당된 장비 정보 조회
  try {
    const devices = await prisma.aed_data.findMany({
      where: {
        equipment_serial: {
          in: profile.assigned_devices
        }
      },
      select: {
        id: true,
        management_number: true,
        equipment_serial: true,
        installation_institution: true,
        installation_address: true,
        battery_expiry_date: true,
        patch_expiry_date: true,
        last_inspection_date: true,
        manufacturer: true,
        model_name: true,
        sido: true,
        gugun: true
      }
    });

    return NextResponse.json({
      devices: devices || [],
      count: devices?.length || 0,
      role: profile.role
    });

  } catch (error) {
    console.error('[API] Error fetching devices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
  }
}
