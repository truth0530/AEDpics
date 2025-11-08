import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncUserToTeam } from '@/lib/auth/team-sync';

// GET: 특정 사용자 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const currentUser = await prisma.user_profiles.findUnique({
      where: { email: session.user.email }
    });

    if (!currentUser || !['master', 'regional_admin', 'local_admin'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 사용자 조회
    const user = await prisma.user_profiles.findUnique({
      where: { id: params.id },
      include: {
        organizations: {
          select: {
            id: true,
            name: true,
            region_code: true,
            city_code: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: 사용자 정보 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const currentUser = await prisma.user_profiles.findUnique({
      where: { email: session.user.email }
    });

    if (!currentUser || !['master', 'regional_admin', 'local_admin'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 요청 데이터 파싱
    const updateData = await request.json();
    const {
      role,
      region,
      district,
      region_code,
      organization_id,
      organization_name,
      is_active
    } = updateData;

    // 사용자 업데이트
    const updatedUser = await prisma.user_profiles.update({
      where: { id: params.id },
      data: {
        role,
        region,
        district,
        region_code,
        organization_id: organization_id || null,
        organization_name: organization_name || null,
        is_active,
        updated_at: new Date()
      }
    });

    // team_members 동기화
    if (organization_id) {
      try {
        await syncUserToTeam(
          updatedUser.id,
          organization_id,
          updatedUser.email,
          updatedUser.full_name,
          role === 'temporary_inspector' ? 'temporary' : 'permanent',
          currentUser.id
        );
      } catch (syncError) {
        console.error('Team sync error:', syncError);
        // 동기화 실패해도 업데이트는 성공으로 처리
      }
    }

    // 임시점검원이고 조직이 변경된 경우 기존 할당 정리
    if (role === 'temporary_inspector' && organization_id) {
      // 기존 pending 할당 제거
      await prisma.inspection_assignments.updateMany({
        where: {
          assigned_to: params.id,
          status: 'pending'
        },
        data: {
          status: 'cancelled',
          notes: '조직 변경으로 인한 자동 취소',
          updated_at: new Date()
        }
      });

      // local_admin 확인
      const hasAdmin = await prisma.user_profiles.findFirst({
        where: {
          organization_id,
          role: 'local_admin',
          is_active: true
        }
      });

      if (!hasAdmin) {
        // local_admin이 없으면 알림 생성 (나중에 처리)
        console.log(`Warning: Organization ${organization_id} has no local_admin for temporary inspector ${params.id}`);
      }
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: '사용자 정보가 성공적으로 업데이트되었습니다'
    });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: 사용자 삭제 (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인 (master만 삭제 가능)
    const currentUser = await prisma.user_profiles.findUnique({
      where: { email: session.user.email }
    });

    if (!currentUser || currentUser.role !== 'master') {
      return NextResponse.json(
        { error: 'Only master admin can delete users' },
        { status: 403 }
      );
    }

    // 소프트 삭제 (비활성화)
    await prisma.user_profiles.update({
      where: { id: params.id },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    });

    // 관련 할당 취소
    await prisma.inspection_assignments.updateMany({
      where: {
        assigned_to: params.id,
        status: { in: ['pending', 'in_progress'] }
      },
      data: {
        status: 'cancelled',
        notes: '사용자 계정 비활성화로 인한 취소',
        updated_at: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: '사용자가 비활성화되었습니다'
    });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
