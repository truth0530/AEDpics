import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';

const prisma = new PrismaClient();

/**
 * POST /api/admin/organization-changes/[id]/approve
 * 조직 변경 요청 승인
 *
 * Request Body:
 * {
 *   "notes": "승인 메모 (선택)"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
    const { notes } = body;

    // 4. 조직 변경 요청 조회
    const changeRequest = await prisma.organizationChangeRequest.findUnique({
      where: { id },
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

    // 5. 이미 처리된 요청인지 확인
    if (changeRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    // 6. 트랜잭션으로 처리: 요청 승인 + 사용자 조직 변경
    const result = await prisma.$transaction(async (tx) => {
      // 6-1. 조직 변경 요청 승인
      const updatedRequest = await tx.organizationChangeRequest.update({
        where: { id },
        data: {
          status: 'approved',
          reviewed_by: adminProfile.id,
          reviewed_at: new Date(),
          admin_notes: notes
        }
      });

      // 6-2. 사용자의 조직 변경
      const updatedUser = await tx.userProfile.update({
        where: { id: changeRequest.user_id },
        data: {
          organization_id: changeRequest.requested_organization_id,
          updated_at: new Date()
        },
        include: {
          organizations: {
            select: {
              id: true,
              name: true,
              type: true
            }
          }
        }
      });

      // 6-3. Audit Log 기록
      await tx.auditLog.create({
        data: {
          user_id: adminProfile.id,
          action: 'organization_change_approved',
          resource_type: 'organization_change_request',
          resource_id: id,
          details: {
            user_id: changeRequest.user_id,
            user_email: changeRequest.user.email,
            old_organization_id: changeRequest.current_organization_id,
            new_organization_id: changeRequest.requested_organization_id,
            notes
          },
          ip_address: request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown'
        }
      });

      return { updatedRequest, updatedUser };
    });

    // 7. TODO: 사용자에게 승인 알림 전송
    // await sendNotificationToUser(changeRequest.user_id, 'organization_change_approved', ...);

    console.log(`[Organization Change Approved] User ${changeRequest.user.email} organization changed to ${changeRequest.requested_organization?.name} by ${adminProfile.email}`);

    return NextResponse.json({
      success: true,
      request: result.updatedRequest,
      user: result.updatedUser
    });

  } catch (error) {
    console.error('[POST /api/admin/organization-changes/[id]/approve] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
