import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';
import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
/**
 * POST /api/admin/organization-changes/[id]/reject
 * 조직 변경 요청 거부 또는 수정 요청 (관리자 전용)
 *
 * Request Body:
 * {
 *   "review_notes": "거부 사유 (필수)",
 *   "requires_revision": false (optional, true면 수정 요청, false면 거부)
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
    const { review_notes, requires_revision } = body;

    // 4. review_notes 필수
    if (!review_notes) {
      return NextResponse.json(
        { error: 'review_notes is required' },
        { status: 400 }
      );
    }

    // 5. 요청 조회
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

    // 6. pending 또는 requires_revision 상태만 처리 가능
    if (!['pending', 'requires_revision'].includes(changeRequest.status)) {
      return NextResponse.json(
        { error: 'Only pending or requires_revision requests can be rejected' },
        { status: 400 }
      );
    }

    // 7. 상태 결정 (수정 요청 vs 거부)
    const newStatus = requires_revision === true ? 'requires_revision' : 'rejected';

    // 8. 요청 상태 업데이트
    const updatedRequest = await prisma.organization_change_requests.update({
      where: { id },
      data: {
        status: newStatus,
        reviewed_by: session.user.id,
        reviewed_at: new Date(),
        review_notes,
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

    // 9. Audit Log 기록
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        user_id: session.user.id,
        action: newStatus === 'rejected' ? 'organization_change_rejected' : 'organization_change_revision_requested',
        entity_type: 'organization_change_request',
        entity_id: id,
        metadata: {
          target_user_id: changeRequest.user_id,
          requested_organization_id: changeRequest.requested_organization_id,
          review_notes,
          requires_revision: requires_revision === true
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    const action = newStatus === 'rejected' ? 'rejected' : 'revision requested';
    console.log(`[Organization Change ${action}] Request ${id} ${action} by ${session.user.email} for user ${changeRequest.user.email}`);

    return NextResponse.json({
      success: true,
      request: updatedRequest
    });

  } catch (error) {
    console.error('[POST /api/admin/organization-changes/[id]/reject] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
