import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';

const prisma = new PrismaClient();

/**
 * POST /api/admin/organization-changes/[id]/reject
 * 조직 변경 요청 거부
 *
 * Request Body:
 * {
 *   "reason": "거부 사유 (필수)"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 관리자 권한 확인
    const adminProfile = await prisma.userProfile.findUnique({
      where: { id: session.user.id }
    });

    if (!adminProfile) {
      return NextResponse.json(
        { error: 'Admin profile not found' },
        { status: 404 }
      );
    }

    if (!checkPermission(adminProfile.role, 'APPROVE_ORG_CHANGES')) {
      return NextResponse.json(
        { error: getPermissionError('APPROVE_ORG_CHANGES') },
        { status: 403 }
      );
    }

    // 3. Request Body 파싱
    const body = await request.json();
    const { reason } = body;

    // 4. 거부 사유 검증
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // 5. 조직 변경 요청 조회
    const changeRequest = await prisma.organizationChangeRequest.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true
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

    if (!changeRequest) {
      return NextResponse.json(
        { error: 'Organization change request not found' },
        { status: 404 }
      );
    }

    // 6. 이미 처리된 요청인지 확인
    if (changeRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    // 7. 조직 변경 요청 거부
    const updatedRequest = await prisma.organizationChangeRequest.update({
      where: { id: params.id },
      data: {
        status: 'rejected',
        reviewed_by: adminProfile.id,
        reviewed_at: new Date(),
        admin_notes: reason
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true
          }
        },
        requested_organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // 8. Audit Log 기록
    await prisma.auditLog.create({
      data: {
        user_id: adminProfile.id,
        action: 'organization_change_rejected',
        resource_type: 'organization_change_request',
        resource_id: params.id,
        details: {
          user_id: changeRequest.user_id,
          user_email: changeRequest.user.email,
          requested_organization_id: changeRequest.requested_organization_id,
          requested_organization_name: changeRequest.requested_organization?.name,
          reason
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // 9. TODO: 사용자에게 거부 알림 전송
    // await sendNotificationToUser(changeRequest.user_id, 'organization_change_rejected', reason);

    console.log(`[Organization Change Rejected] User ${changeRequest.user.email} request rejected by ${adminProfile.email}. Reason: ${reason}`);

    return NextResponse.json({
      success: true,
      request: updatedRequest,
      message: '조직 변경 요청이 거부되었습니다.'
    });

  } catch (error) {
    console.error('[POST /api/admin/organization-changes/[id]/reject] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
