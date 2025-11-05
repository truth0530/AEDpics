import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
/**
 * DELETE /api/profile/organization-change/[id]
 * 조직 변경 요청 취소 (cancelled 상태로 변경)
 */
export async function DELETE(
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

    // 2. Params 파싱
    const { id } = await params;

    // 3. 요청 조회
    const changeRequest = await prisma.organization_change_requests.findUnique({
      where: { id }
    });

    if (!changeRequest) {
      return NextResponse.json(
        { error: 'Organization change request not found' },
        { status: 404 }
      );
    }

    // 4. 본인의 요청인지 확인
    if (changeRequest.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only cancel your own requests' },
        { status: 403 }
      );
    }

    // 5. pending 또는 requires_revision 상태만 취소 가능
    if (!['pending', 'requires_revision'].includes(changeRequest.status)) {
      return NextResponse.json(
        { error: 'Only pending or requires_revision requests can be cancelled' },
        { status: 400 }
      );
    }

    // 6. 상태를 cancelled로 변경
    const updatedRequest = await prisma.organization_change_requests.update({
      where: { id },
      data: {
        status: 'cancelled',
        updated_at: new Date()
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

    // 7. Audit Log 기록
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        user_id: session.user.id,
        action: 'organization_change_cancelled',
        entity_type: 'organization_change_request',
        entity_id: id,
        metadata: {
          previous_status: changeRequest.status,
          requested_organization_id: changeRequest.requested_organization_id
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    console.log(`[Organization Change Request Cancelled] Request ${id} cancelled by user ${session.user.email}`);

    return NextResponse.json({
      success: true,
      request: updatedRequest
    });

  } catch (error) {
    console.error('[DELETE /api/profile/organization-change/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
