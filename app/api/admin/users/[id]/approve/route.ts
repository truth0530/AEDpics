import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, UserRole } from '@prisma/client';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';

const prisma = new PrismaClient();

/**
 * POST /api/admin/users/[id]/approve
 * 사용자 승인
 *
 * Request Body:
 * {
 *   "role": "local_admin" | "inspector" | "temporary_inspector" 등
 *   "notes": "승인 사유 (선택)"
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

    // 2. 관리자 프로필 조회
    const adminProfile = await prisma.userProfile.findUnique({
      where: { id: session.user.id }
    });

    if (!adminProfile) {
      return NextResponse.json(
        { error: 'Admin profile not found' },
        { status: 404 }
      );
    }

    // 3. 권한 확인
    if (!checkPermission(adminProfile.role, 'APPROVE_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('APPROVE_USERS') },
        { status: 403 }
      );
    }

    // 4. Request Body 파싱
    const body = await request.json();
    const { role, notes } = body;

    if (!role) {
      return NextResponse.json(
        { error: 'Role is required' },
        { status: 400 }
      );
    }

    // 5. 승인할 사용자 조회
    const targetUser = await prisma.userProfile.findUnique({
      where: { id: params.id }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 6. 이미 승인된 사용자인지 확인
    if (targetUser.role !== 'pending_approval' && targetUser.role !== 'email_verified') {
      return NextResponse.json(
        { error: 'User is already approved or rejected' },
        { status: 400 }
      );
    }

    // 7. 사용자 승인 (role 변경)
    const updatedUser = await prisma.userProfile.update({
      where: { id: params.id },
      data: {
        role: role as UserRole,
        approved_by: adminProfile.id,
        approved_at: new Date(),
        is_active: true,
        updated_at: new Date()
      },
      include: {
        organizations: true
      }
    });

    // 8. Audit Log 기록
    await prisma.auditLog.create({
      data: {
        user_id: adminProfile.id,
        action: 'user_approved',
        resource_type: 'user_profile',
        resource_id: params.id,
        details: {
          target_user_id: params.id,
          target_user_email: targetUser.email,
          approved_role: role,
          notes: notes || null
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // 9. TODO: 승인 이메일 발송
    // await sendApprovalEmail(updatedUser.email, role);

    console.log(`[User Approved] ${targetUser.email} approved as ${role} by ${adminProfile.email}`);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: '사용자가 승인되었습니다.'
    });

  } catch (error) {
    console.error('[POST /api/admin/users/[id]/approve] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
