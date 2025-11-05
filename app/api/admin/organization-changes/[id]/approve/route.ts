import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';
import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
/**
 * POST /api/admin/organization-changes/[id]/approve
 * 조직 변경 요청 승인 (관리자 전용)
 *
 * Request Body (optional):
 * {
 *   "review_notes": "승인 메모"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const currentProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentProfile || !checkPermission(currentProfile.role, 'APPROVE_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('APPROVE_USERS') },
        { status: 403 }
      );
    }

    // 3. Params 및 Body 파싱
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { review_notes } = body;

    // 4. 요청 조회
    const changeRequest = await prisma.organization_change_requests.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true
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

    // 5. pending 또는 requires_revision 상태만 승인 가능
    if (!['pending', 'requires_revision'].includes(changeRequest.status)) {
      return NextResponse.json(
        { error: 'Only pending or requires_revision requests can be approved' },
        { status: 400 }
      );
    }

    // 6. 트랜잭션으로 처리 (요청 승인 + 사용자 조직 변경)
    const result = await prisma.$transaction(async (tx) => {
      // 6-1. 사용자의 조직 변경
      await tx.user_profiles.update({
        where: { id: changeRequest.user_id },
        data: {
          organization_id: changeRequest.requested_organization_id,
          updated_at: new Date()
        }
      });

      // 6-2. 요청 상태 업데이트
      const updatedRequest = await tx.organization_change_requests.update({
        where: { id },
        data: {
          status: 'approved',
          reviewed_by: session.user.id,
          reviewed_at: new Date(),
          review_notes: review_notes || null,
          updated_at: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              full_name: true,
              email: true
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
          reviewer: {
            select: {
              id: true,
              full_name: true,
              email: true
            }
          }
        }
      });

      // 6-3. Audit Log 기록
      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          user_id: session.user.id,
          action: 'organization_change_approved',
          entity_type: 'organization_change_request',
          entity_id: id,
          metadata: {
            target_user_id: changeRequest.user_id,
            previous_organization_id: changeRequest.current_organization_id,
            new_organization_id: changeRequest.requested_organization_id,
            review_notes: review_notes || null
          },
          ip_address: request.headers.get('x-forwarded-for') ||
                      request.headers.get('x-real-ip') ||
                      'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown'
        }
      });

      return updatedRequest;
    });

    console.log(`[Organization Change Approved] Request ${id} approved by ${session.user.email} for user ${changeRequest.user.email}`);

    return NextResponse.json({
      success: true,
      request: result
    });

  } catch (error) {
    console.error('[POST /api/admin/organization-changes/[id]/approve] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
