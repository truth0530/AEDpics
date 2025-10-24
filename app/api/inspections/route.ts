/**
 * 점검 기록 API
 *
 * POST /api/inspections - 점검 기록 생성
 * GET /api/inspections - 점검 기록 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma, createAuditLog } from '@/lib/db/prisma';
import { checkRateLimit, createRateLimitResponse, getIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limiter';
import { getSocketServer } from '@/lib/realtime/socket-server';

/**
 * 점검 기록 생성
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, RATE_LIMIT_CONFIGS.inspection);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    // JWT 인증
    const cookieToken = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || headerToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // 요청 본문 파싱
    const body = await request.json();
    const {
      deviceId,
      inspectionDate,
      status,
      notes,
      photoPaths,
      batteryStatus,
      paddleStatus,
    } = body;

    // 필수 필드 검증
    if (!deviceId || !inspectionDate || !status) {
      return NextResponse.json(
        { error: 'deviceId, inspectionDate, and status are required' },
        { status: 400 }
      );
    }

    // AED 기기 존재 확인
    const device = await prisma.aEDDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // 점검 기록 생성
    const inspection = await prisma.inspectionRecord.create({
      data: {
        deviceId,
        inspectorId: payload.userId,
        inspectionDate: new Date(inspectionDate),
        status,
        notes,
        photoPaths: photoPaths || [],
        batteryStatus,
        paddleStatus,
      },
      include: {
        device: true,
        inspector: {
          include: {
            profile: true,
          },
        },
      },
    });

    // AED 기기의 lastInspectionDate 업데이트
    await prisma.aEDDevice.update({
      where: { id: deviceId },
      data: { lastInspectionDate: new Date(inspectionDate) },
    });

    // 감사 로그 기록
    await createAuditLog({
      userId: payload.userId,
      action: 'CREATE',
      resource: 'InspectionRecord',
      resourceId: inspection.id,
      changes: { deviceId, status },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Socket.IO 실시간 알림 (다른 사용자에게 브로드캐스트)
    const socketServer = getSocketServer();
    if (socketServer) {
      // 전체 브로드캐스트
      // socketServer.broadcast() 메서드는 없으므로 직접 구현 필요
      console.log('[Inspection API] Created inspection:', inspection.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Inspection record created successfully',
      inspection: {
        id: inspection.id,
        deviceId: inspection.deviceId,
        deviceCode: inspection.device.deviceCode,
        inspectorId: inspection.inspectorId,
        inspectorName: inspection.inspector.name,
        inspectionDate: inspection.inspectionDate,
        status: inspection.status,
        notes: inspection.notes,
        photoPaths: inspection.photoPaths,
        batteryStatus: inspection.batteryStatus,
        paddleStatus: inspection.paddleStatus,
        createdAt: inspection.createdAt,
      },
    });
  } catch (error) {
    console.error('[Inspection API] Create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 점검 기록 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, RATE_LIMIT_CONFIGS.inspection);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    // JWT 인증
    const cookieToken = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken || headerToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // 사용자 프로필 조회
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: payload.userId },
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams;
    const deviceId = searchParams.get('deviceId');
    const inspectorId = searchParams.get('inspectorId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    // 쿼리 조건
    const whereClause: any = {};

    if (deviceId) {
      whereClause.deviceId = parseInt(deviceId, 10);
    }

    if (inspectorId) {
      whereClause.inspectorId = parseInt(inspectorId, 10);
    } else if (!['admin', 'master'].includes(userProfile.role)) {
      // 일반 사용자는 자신의 점검 기록만 조회
      whereClause.inspectorId = payload.userId;
    }

    if (status) {
      whereClause.status = status;
    }

    // 데이터 조회
    const [inspections, totalCount] = await Promise.all([
      prisma.inspectionRecord.findMany({
        where: whereClause,
        include: {
          device: {
            select: {
              deviceCode: true,
              location: true,
              region: true,
            },
          },
          inspector: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { inspectionDate: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.inspectionRecord.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      data: inspections,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('[Inspection API] List error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
