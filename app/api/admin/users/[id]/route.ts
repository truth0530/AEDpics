import { NextRequest, NextResponse } from 'next/server';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';
import { requireAuthWithProfile, isErrorResponse } from '@/lib/auth/session-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/users/[id]
 * 단일 사용자 조회 (관리자용)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15: params는 Promise
    const { id } = await params;

    // 인증 및 프로필 조회
    const authResult = await requireAuthWithProfile();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { profile: userProfile } = authResult;

    // 권한 확인 (LIST_USERS 또는 APPROVE_USERS 권한 필요)
    if (!checkPermission(userProfile.role, 'LIST_USERS') &&
        !checkPermission(userProfile.role, 'APPROVE_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('LIST_USERS') },
        { status: 403 }
      );
    }

    // 사용자 조회
    const user = await prisma.user_profiles.findUnique({
      where: { id },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            type: true,
            region_code: true,
            city_code: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 응답 반환
    return NextResponse.json(user);

  } catch (error) {
    console.error(`[GET /api/admin/users/[id]] Error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id]
 * 사용자 정보 수정 (관리자용)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15: params는 Promise
    const { id } = await params;

    // 인증 및 프로필 조회
    const authResult = await requireAuthWithProfile();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { profile: userProfile } = authResult;

    // 권한 확인 (사용자 승인 권한이 있어야 정보 수정 가능)
    if (!checkPermission(userProfile.role, 'APPROVE_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('APPROVE_USERS') },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    const body = await request.json();
    const { role, region_code, organization_id, ...otherFields } = body;

    // 기존 사용자 조회
    const existingUser = await prisma.user_profiles.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 업데이트할 데이터 구성
    const updateData: any = { ...otherFields };

    if (role !== undefined) {
      updateData.role = role;
    }

    if (region_code !== undefined) {
      updateData.region_code = region_code;
    }

    if (organization_id !== undefined) {
      updateData.organization_id = organization_id;
    }

    // 사용자 정보 업데이트
    const updatedUser = await prisma.user_profiles.update({
      where: { id },
      data: updateData,
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            type: true,
            region_code: true,
            city_code: true,
          }
        }
      }
    });

    // 응답 반환
    return NextResponse.json({
      message: '사용자 정보가 업데이트되었습니다.',
      user: updatedUser
    });

  } catch (error) {
    console.error(`[PATCH /api/admin/users/[id]] Error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 * 사용자 삭제 (관리자용)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15: params는 Promise
    const { id } = await params;

    // 인증 및 프로필 조회
    const authResult = await requireAuthWithProfile();

    if (isErrorResponse(authResult)) {
      return authResult;
    }

    const { profile: userProfile } = authResult;

    // 권한 확인 (master만 삭제 가능)
    if (userProfile.role !== 'master') {
      return NextResponse.json(
        { error: '사용자 삭제 권한이 없습니다. Master 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 자기 자신은 삭제 불가
    if (id === userProfile.id) {
      return NextResponse.json(
        { error: '자기 자신을 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 사용자 존재 확인
    const existingUser = await prisma.user_profiles.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사용자 삭제
    await prisma.user_profiles.delete({
      where: { id }
    });

    // 응답 반환
    return NextResponse.json({
      message: '사용자가 삭제되었습니다.',
      deletedUserId: id
    });

  } catch (error) {
    console.error(`[DELETE /api/admin/users/[id]] Error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
