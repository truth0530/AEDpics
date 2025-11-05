import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
/**
 * GET /api/profile/organization-change
 * 현재 사용자의 조직 변경 요청 조회
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

    // 2. 현재 사용자의 조직 변경 요청 조회 (pending 또는 requires_revision 상태만)
    const requests = await prisma.organization_change_requests.findMany({
      where: {
        user_id: session.user.id,
        status: {
          in: ['pending', 'requires_revision']
        }
      },
      include: {
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
        reviewer: {
          select: {
            id: true,
            full_name: true,
            email: true
          }
        }
      },
      orderBy: {
        requested_at: 'desc'
      }
    });

    return NextResponse.json({ requests });

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
 *   "requested_organization_id": "UUID",
 *   "reason": "변경 사유 (선택)"
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
    if (!requested_organization_id) {
      return NextResponse.json(
        { error: 'requested_organization_id is required' },
        { status: 400 }
      );
    }

    // 4. 현재 사용자 프로필 조회
    const currentProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        organization_id: true,
        role: true
      }
    });

    if (!currentProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // 5. 이미 대기 중인 요청이 있는지 확인
    const existingRequest = await prisma.organization_change_requests.findFirst({
      where: {
        user_id: session.user.id,
        status: {
          in: ['pending', 'requires_revision']
        }
      }
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending organization change request' },
        { status: 400 }
      );
    }

    // 6. 요청하는 조직이 존재하는지 확인
    const requestedOrganization = await prisma.organizations.findUnique({
      where: { id: requested_organization_id }
    });

    if (!requestedOrganization) {
      return NextResponse.json(
        { error: 'Requested organization not found' },
        { status: 404 }
      );
    }

    // 7. 현재 조직과 동일한 조직으로 변경 요청하는지 확인
    if (currentProfile.organization_id === requested_organization_id) {
      return NextResponse.json(
        { error: 'Cannot request change to current organization' },
        { status: 400 }
      );
    }

    // 8. 조직 변경 요청 생성
    const changeRequest = await prisma.organization_change_requests.create({
      data: {
        id: randomUUID(),
        user_id: session.user.id,
        current_organization_id: currentProfile.organization_id,
        requested_organization_id,
        reason: reason || null,
        status: 'pending'
      },
      include: {
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
        }
      }
    });

    // 9. Audit Log 기록
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        user_id: session.user.id,
        action: 'organization_change_requested',
        entity_type: 'organization_change_request',
        entity_id: changeRequest.id,
        metadata: {
          current_organization_id: currentProfile.organization_id,
          requested_organization_id,
          reason: reason || null
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    console.log(`[Organization Change Request] User ${session.user.email} requested change from ${currentProfile.organization_id || 'none'} to ${requested_organization_id}`);

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
