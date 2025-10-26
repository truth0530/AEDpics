import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * DELETE /api/profile/organization-change/[id]
 * 조직 변경 요청 취소
 *
 * 본인이 생성한 pending 상태의 요청만 취소 가능
 */
export async function DELETE(
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

    // 2. 조직 변경 요청 조회
    const changeRequest = await prisma.organizationChangeRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true
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

    if (!changeRequest) {
      return NextResponse.json(
        { error: 'Organization change request not found' },
        { status: 404 }
      );
    }

    // 3. 본인의 요청인지 확인
    if (changeRequest.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only cancel your own requests' },
        { status: 403 }
      );
    }

    // 4. pending 상태인지 확인
    if (changeRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending requests can be cancelled' },
        { status: 400 }
      );
    }

    // 5. 요청 삭제
    await prisma.organizationChangeRequest.delete({
      where: { id }
    });

    // 6. Audit Log 기록
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: 'organization_change_cancelled',
        resource_type: 'organization_change_request',
        resource_id: id,
        details: {
          requested_organization_id: changeRequest.requested_organization_id,
          requested_organization_name: changeRequest.requested_organization?.name,
          reason: changeRequest.reason
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    console.log(`[Organization Change Cancelled] User ${changeRequest.user.email} cancelled request ${id}`);

    return NextResponse.json({
      success: true,
      message: '조직 변경 요청이 취소되었습니다.'
    });

  } catch (error) {
    console.error('[DELETE /api/profile/organization-change/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
