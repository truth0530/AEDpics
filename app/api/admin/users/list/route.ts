import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { decryptPhone } from '@/lib/utils/encryption';

export async function GET(request: NextRequest) {
  try {
    // 현재 사용자 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const currentProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    // 사용자 목록 조회 권한 확인
    const { checkPermission, getPermissionError } = await import('@/lib/auth/permissions');
    if (!currentProfile || !checkPermission(currentProfile.role, 'LIST_USERS')) {
      return NextResponse.json(
        { error: getPermissionError('LIST_USERS') },
        { status: 403 }
      );
    }

    // URL 매개변수 파싱
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // pending_approval, approved, rejected 등
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // 최대 100개로 제한
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search'); // 이름, 이메일 검색

    // Prisma where 조건 구성
    const where: any = {};

    // 상태 필터 적용
    if (status === 'pending_approval') {
      where.role = 'pending_approval';
    } else if (status === 'approved') {
      where.AND = [
        { role: { not: 'pending_approval' } },
        { role: { not: 'rejected' } },
        { isActive: true }
      ];
    } else if (status === 'rejected') {
      where.role = 'rejected';
    } else if (status) {
      where.role = status;
    }

    // 검색 필터 적용
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Prisma 쿼리 실행
    try {
      const [profiles, count] = await Promise.all([
        prisma.user_profiles.findMany({
          where,
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                type: true,
                regionCode: true,
                cityCode: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.user_profiles.count({ where })
      ]);

      console.log('Loaded profiles:', profiles?.length || 0, 'of', count || 0);

      // 프로필 데이터 정리
      const processedProfiles = profiles?.map(profile => {
        const organizationData = profile.organization;
        const organizationName = organizationData?.name || profile.organizationName || null;
        const healthCenterName = organizationData?.type === 'health_center'
          ? organizationData?.name
          : (profile.organizationName || null);

        // 전화번호 복호화 (하위 호환성 보장)
        const decryptedPhone = profile.phone ? decryptPhone(profile.phone) : null;

        return {
          id: profile.id,
          email: profile.email,
          fullName: profile.fullName || profile.email?.split('@')[0] || '이름 없음',
          role: profile.role,
          phone: decryptedPhone,
          organizationId: profile.organizationId,
          organization_name: organizationName,
          health_center: healthCenterName,
          department: profile.department,
          regionCode: profile.regionCode,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
          lastLoginAt: profile.lastLoginAt,
          loginCount: profile.loginCount || 0,
          isActive: profile.isActive,
          organization: organizationData
        };
      }) || [];

      return NextResponse.json({
        users: processedProfiles,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        }
      });

    } catch (queryError) {
      console.error('Error loading profiles:', queryError);
      return NextResponse.json(
        { error: '사용자 목록을 불러오는 중 오류가 발생했습니다.', details: queryError instanceof Error ? queryError.message : String(queryError) },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Users list error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
