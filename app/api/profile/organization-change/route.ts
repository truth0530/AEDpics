import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/profile/organization-change
 * 내 조직 변경 요청 목록 조회
 *
 * Query Parameters:
 * - status: 요청 상태 필터 (pending, approved, rejected)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Query Parameters 파싱
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // 3. 조회 조건 구성
    const where: any = {
      user_id: session.user.id
    };

    if (status) {
      where.status = status;
    }

    // 4. 조직 변경 요청 목록 조회
    const requests = await prisma.organizationChangeRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        },
        current_organization: {
          select: {
            id: true,
            name: true,
            type: true,
            region_code: true
          }
        },
        requested_organization: {
          select: {
            id: true,
            name: true,
            type: true,
            region_code: true
          }
        },
        reviewed_by_profile: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json({
      requests
    });

  } catch (error) {
    console.error('[GET /api/profile/organization-change] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile/organization-change
 * 조직 변경 요청 생성
 *
 * Request Body:
 * {
 *   "requested_organization_id": "조직 ID (필수)",
 *   "reason": "변경 사유 (필수)"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Request Body 파싱
    const body = await request.json();
    const { requested_organization_id, reason } = body;

    // 3. 입력값 검증
    if (!requested_organization_id || !reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'requested_organization_id and reason are required' },
        { status: 400 }
      );
    }

    // 4. 현재 사용자 프로필 조회
    const userProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id }
    });

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // 5. 요청하려는 조직이 존재하는지 확인
    const requestedOrganization = await prisma.organization.findUnique({
      where: { id: requested_organization_id }
    });

    if (!requestedOrganization) {
      return NextResponse.json(
        { error: 'Requested organization not found' },
        { status: 404 }
      );
    }

    // 6. 이미 동일한 조직으로 변경 요청이 pending 상태인지 확인
    const existingPendingRequest = await prisma.organizationChangeRequest.findFirst({
      where: {
        user_id: session.user.id,
        requested_organization_id,
        status: 'pending'
      }
    });

    if (existingPendingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending request for this organization' },
        { status: 400 }
      );
    }

    // 7. 조직 변경 요청 생성
    const changeRequest = await prisma.organizationChangeRequest.create({
      data: {
        user_id: session.user.id,
        current_organization_id: userProfile.organization_id,
        requested_organization_id,
        reason,
        status: 'pending'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        },
        current_organization: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        requested_organization: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    // 8. Audit Log 기록
    await prisma.audit_logs.create({
      data: {
        user_id: session.user.id,
        action: 'organization_change_requested',
        resource_type: 'organization_change_request',
        resource_id: changeRequest.id,
        details: {
          current_organization_id: userProfile.organization_id,
          requested_organization_id,
          reason
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // 9. TODO: 관리자에게 알림 전송
    // await sendNotificationToAdmins('organization_change_requested', changeRequest);

    console.log(`[Organization Change Requested] User ${userProfile.email} requested to change organization to ${requestedOrganization.name}`);

    return NextResponse.json({
      success: true,
      request: changeRequest
    }, { status: 201 });

  } catch (error) {
    console.error('[POST /api/profile/organization-change] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
