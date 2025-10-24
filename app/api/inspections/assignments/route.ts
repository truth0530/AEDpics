/**
 * 점검 일정 할당 API
 *
 * POST /api/inspections/assignments - 일정 할당
 * GET /api/inspections/assignments - 내 일정 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma, createAuditLog } from '@/lib/db/prisma';
import { checkRateLimit, createRateLimitResponse, getIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limiter';
import { sendAssignmentNotificationEmail } from '@/lib/email/mailer';

/**
 * 일정 할당 생성
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, RATE_LIMIT_CONFIGS.admin);

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

    // 권한 확인 (admin/master만 할당 가능)
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: payload.userId },
    });

    if (!['admin', 'master'].includes(userProfile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden: Only admins can assign inspections' }, { status: 403 });
    }

    // 요청 본문 파싱
    const body = await request.json();
    const {
      equipmentSerial,
      assignedTo,
      assignmentType,
      scheduledDate,
      scheduledTime,
      priorityLevel,
      notes,
    } = body;

    // 필수 필드 검증
    if (!equipmentSerial || !assignedTo) {
      return NextResponse.json(
        { error: 'equipmentSerial and assignedTo are required' },
        { status: 400 }
      );
    }

    // 할당 대상 사용자 확인
    const assignee = await prisma.user.findUnique({
      where: { id: assignedTo },
      include: { profile: true },
    });

    if (!assignee) {
      return NextResponse.json({ error: 'Assignee not found' }, { status: 404 });
    }

    // 일정 할당 생성
    const assignment = await prisma.inspectionAssignment.create({
      data: {
        equipmentSerial,
        assignedTo,
        assignedBy: payload.userId,
        assignmentType: assignmentType || 'scheduled',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTime,
        priorityLevel: priorityLevel || 0,
        notes,
        status: 'pending',
      },
    });

    // 이메일 알림 발송
    if (assignee.email && scheduledDate) {
      await sendAssignmentNotificationEmail(assignee.email, {
        inspectorName: assignee.name || assignee.email,
        equipmentSerial,
        scheduledDate,
        location: 'TBD', // 실제로는 AED 기기 정보에서 가져와야 함
      });
    }

    // 감사 로그 기록
    await createAuditLog({
      userId: payload.userId,
      action: 'CREATE',
      resource: 'InspectionAssignment',
      resourceId: assignment.id,
      changes: { equipmentSerial, assignedTo, assignmentType },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Assignment created successfully',
      assignment,
    });
  } catch (error) {
    console.error('[Assignment API] Create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 내 일정 조회
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

    // 쿼리 파라미터
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 쿼리 조건
    const whereClause: any = {};

    // 사용자 프로필 조회
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: payload.userId },
    });

    // admin/master는 모든 일정 조회 가능, 일반 사용자는 자신의 일정만
    if (assignedTo) {
      whereClause.assignedTo = parseInt(assignedTo, 10);
    } else if (!['admin', 'master'].includes(userProfile?.role || '')) {
      whereClause.assignedTo = payload.userId;
    }

    if (status) {
      whereClause.status = status;
    }

    // 일정 조회
    const assignments = await prisma.inspectionAssignment.findMany({
      where: whereClause,
      orderBy: [
        { priorityLevel: 'desc' },
        { scheduledDate: 'asc' },
      ],
      take: limit,
    });

    return NextResponse.json({
      data: assignments,
      count: assignments.length,
    });
  } catch (error) {
    console.error('[Assignment API] List error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
