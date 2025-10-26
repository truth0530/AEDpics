import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serial = searchParams.get('serial');

    if (!serial) {
      return NextResponse.json(
        { error: 'Serial number is required' },
        { status: 400 }
      );
    }

    // 사용자 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 제조번호로 장비 검색
    const devices = await prisma.aed_data.findMany({
      where: {
        equipment_serial: serial
      },
      select: {
        id: true,
        equipment_serial: true,
        installation_institution: true,
        installation_address: true,
        sido: true,
        gugun: true
      }
    });

    const isDuplicate = devices && devices.length > 1;
    const count = devices?.length || 0;

    let locationInfo = undefined;
    if (isDuplicate && devices) {
      // 첫 번째 장비 위치 정보 제공
      const firstDevice = devices[0];
      locationInfo = `${firstDevice.sido || ''} ${firstDevice.gugun || ''} ${firstDevice.installation_institution || ''}`.trim();
    }

    return NextResponse.json({
      is_duplicate: isDuplicate,
      count,
      location_info: locationInfo,
    });
  } catch (error) {
    console.error('check-duplicate-serial error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
