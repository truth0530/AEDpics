import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { checkPermission, getPermissionError } from '@/lib/auth/permissions';
import { randomUUID } from 'crypto';

import { prisma } from '@/lib/prisma';
/**
 * PUT /api/admin/organizations/[id]
 * 조직 수정
 *
 * Request Body:
 * {
 *   "name": "조직명",
 *   "type": "조직 타입",
 *   "region_code": "지역 코드"
 * }
 */
export async function PUT(
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
    const currentProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentProfile || !checkPermission(currentProfile.role, 'MANAGE_ORGANIZATIONS')) {
      return NextResponse.json(
        { error: getPermissionError('MANAGE_ORGANIZATIONS') },
        { status: 403 }
      );
    }

    // 3. 조직 존재 확인
    const existingOrg = await prisma.organizations.findUnique({
      where: { id }
    });

    if (!existingOrg) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // 4. Request Body 파싱
    const body = await request.json();
    const { name, type, region_code } = body;

    // 5. 수정할 데이터 구성
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (region_code !== undefined) updateData.region_code = region_code;

    // 6. 동일한 이름의 다른 조직이 있는지 확인 (name이 변경되는 경우만)
    if (name && name !== existingOrg.name) {
      const duplicateOrg = await prisma.organizations.findFirst({
        where: {
          name,
          region_code: region_code || existingOrg.region_code,
          id: {
            not: id
          }
        }
      });

      if (duplicateOrg) {
        return NextResponse.json(
          { error: 'Organization with this name already exists in this region' },
          { status: 400 }
        );
      }
    }

    // 7. 조직 수정
    const organization = await prisma.organizations.update({
      where: { id },
      data: updateData
    });

    // 8. Audit Log 기록
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        user_id: session.user.id,
        action: 'organization_updated',
        entity_type: 'organization',
        entity_id: id,
        metadata: {
          old_data: existingOrg,
          new_data: organization
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    console.log(`[Organization Updated] ${organization.name} updated by ${session.user.email}`);

    return NextResponse.json({
      success: true,
      organization
    });

  } catch (error) {
    console.error('[PUT /api/admin/organizations/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/[id]
 * 조직 삭제
 *
 * 주의: 해당 조직에 속한 사용자가 있으면 삭제 불가
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

    // 2. 관리자 권한 확인
    const currentProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (!currentProfile || !checkPermission(currentProfile.role, 'MANAGE_ORGANIZATIONS')) {
      return NextResponse.json(
        { error: getPermissionError('MANAGE_ORGANIZATIONS') },
        { status: 403 }
      );
    }

    // 3. 조직 존재 확인
    const organization = await prisma.organizations.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            user_profiles: true
          }
        }
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // 4. 조직에 속한 사용자가 있는지 확인
    if (organization._count.user_profiles > 0) {
      return NextResponse.json(
        { error: `Cannot delete organization with ${organization._count.user_profiles} associated users` },
        { status: 400 }
      );
    }

    // 5. Audit Log 기록 (삭제 전에)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        user_id: session.user.id,
        action: 'organization_deleted',
        entity_type: 'organization',
        entity_id: id,
        metadata: {
          name: organization.name,
          type: organization.type,
          region_code: organization.region_code
        },
        ip_address: request.headers.get('x-forwarded-for') ||
                    request.headers.get('x-real-ip') ||
                    'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // 6. 조직 삭제
    await prisma.organizations.delete({
      where: { id }
    });

    console.log(`[Organization Deleted] ${organization.name} deleted by ${session.user.email}`);

    return NextResponse.json({
      success: true,
      message: '조직이 삭제되었습니다.'
    });

  } catch (error) {
    console.error('[DELETE /api/admin/organizations/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
