/**
 * 점검 기록 상세 API
 *
 * GET /api/inspections/:id - 점검 기록 조회
 * PUT /api/inspections/:id - 점검 기록 수정
 * DELETE /api/inspections/:id - 점검 기록 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma, createAuditLog } from '@/lib/db/prisma';

/**
 * 점검 기록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const inspectionId = parseInt(params.id, 10);

    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: 'Invalid inspection ID' }, { status: 400 });
    }

    // 점검 기록 조회
    const inspection = await prisma.inspectionRecord.findUnique({
      where: { id: inspectionId },
      include: {
        device: {
          select: {
            deviceCode: true,
            location: true,
            region: true,
            latitude: true,
            longitude: true,
          },
        },
        inspector: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }

    // 권한 확인 (자신의 기록이거나 admin/master)
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: payload.userId },
    });

    if (
      inspection.inspectorId !== payload.userId &&
      !['admin', 'master'].includes(userProfile?.role || '')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      inspection,
    });
  } catch (error) {
    console.error('[Inspection Detail API] Get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 점검 기록 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const inspectionId = parseInt(params.id, 10);

    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: 'Invalid inspection ID' }, { status: 400 });
    }

    // 기존 기록 조회
    const existingInspection = await prisma.inspectionRecord.findUnique({
      where: { id: inspectionId },
    });

    if (!existingInspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }

    // 권한 확인 (자신의 기록만 수정 가능)
    if (existingInspection.inspectorId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 요청 본문 파싱
    const body = await request.json();
    const {
      status,
      notes,
      photoPaths,
      batteryStatus,
      paddleStatus,
    } = body;

    // 점검 기록 업데이트
    const updatedInspection = await prisma.inspectionRecord.update({
      where: { id: inspectionId },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(photoPaths && { photoPaths }),
        ...(batteryStatus && { batteryStatus }),
        ...(paddleStatus && { paddleStatus }),
      },
      include: {
        device: true,
        inspector: true,
      },
    });

    // 감사 로그 기록
    await createAuditLog({
      userId: payload.userId,
      action: 'UPDATE',
      resource: 'InspectionRecord',
      resourceId: inspectionId,
      changes: { status, notes, batteryStatus, paddleStatus },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Inspection record updated successfully',
      inspection: updatedInspection,
    });
  } catch (error) {
    console.error('[Inspection Detail API] Update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 점검 기록 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const inspectionId = parseInt(params.id, 10);

    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: 'Invalid inspection ID' }, { status: 400 });
    }

    // 기존 기록 조회
    const existingInspection = await prisma.inspectionRecord.findUnique({
      where: { id: inspectionId },
    });

    if (!existingInspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }

    // 권한 확인 (admin/master만 삭제 가능)
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: payload.userId },
    });

    if (!['admin', 'master'].includes(userProfile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 점검 기록 삭제
    await prisma.inspectionRecord.delete({
      where: { id: inspectionId },
    });

    // 감사 로그 기록
    await createAuditLog({
      userId: payload.userId,
      action: 'DELETE',
      resource: 'InspectionRecord',
      resourceId: inspectionId,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Inspection record deleted successfully',
    });
  } catch (error) {
    console.error('[Inspection Detail API] Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
