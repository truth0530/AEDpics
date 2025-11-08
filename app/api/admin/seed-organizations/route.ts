import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
/**
 * Organizations 데이터 자동 시딩 API (Phase 2 개선 - 2025-11-09)
 *
 * 사용법: POST /api/admin/seed-organizations
 * 권한: Master 또는 Emergency Center Admin만 실행 가능
 *
 * 개선사항:
 * - 43개 하드코딩된 보건소 데이터 제거
 * - orgFactory에서 동적으로 18개 지역 × 평균 25개 = 425+개 조직 생성
 * - guguns 배열을 직접 순회하여 city_code 추출 (문자열 파싱 제거)
 * - generateHealthCenterName() 헬퍼 함수로 명칭 생성 통합
 */

import { NextRequest, NextResponse } from 'next/server';
import { hasSystemAdminAccess } from '@/lib/auth/permissions';
import { randomUUID } from 'crypto';
import { generateRegionOrganizations } from '@/lib/services/orgFactory';
import { generateHealthCenterName } from '@/lib/constants/regions';
import { prisma } from '@/lib/prisma';

/**
 * 팩토리 데이터를 DB 삽입 형식으로 변환
 *
 * @returns 모든 조직 데이터 (중앙 제외)
 */
function generateSeedOrganizations() {
  const regionOrgData = generateRegionOrganizations();
  const allOrganizations = [];

  for (const data of regionOrgData) {
    // 중앙(KR) 제외 - DB에 실제 AED 데이터가 없음
    if (data.regionCode === 'KR') continue;

    // 1. 정식 지역명(시도청) 추가
    allOrganizations.push({
      id: randomUUID(),
      name: data.fullRegionName,  // 예: '서울특별시', '부산광역시'
      region_code: data.regionCode,  // 'SEO', 'BUS'
      city_code: null,  // 시도 수준은 city_code 없음
      type: 'provincial_government',
      contact: null,
      address: null,
    });

    // 2. 응급의료지원센터 추가
    allOrganizations.push({
      id: randomUUID(),
      name: `${data.region}응급의료지원센터`,  // 예: '서울응급의료지원센터'
      region_code: data.regionCode,
      city_code: null,
      type: 'emergency_center',
      contact: null,
      address: null,
    });

    // 3. 각 구군별 보건소 추가 (guguns 배열 직접 순회)
    // ✅ FIX: 문자열 파싱 제거 - guguns에서 직접 가져옴
    // 이렇게 하면 세종, 제주, 다문자 구군도 자동 처리됨
    data.guguns.forEach(gugun => {
      allOrganizations.push({
        id: randomUUID(),
        name: generateHealthCenterName(data.regionCode, gugun),  // 예: '서울특별시 강남구 보건소'
        region_code: data.regionCode,
        city_code: gugun,  // ✅ gugun을 직접 사용 (문자열 파싱 불필요)
        type: 'health_center',
        contact: null,
        address: null,
      });
    });
  }

  return allOrganizations;
}

export async function POST(request: NextRequest) {
  try {
    // 현재 사용자 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 현재 사용자의 프로필 조회
    const currentUserProfile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 시스템 관리자 권한 확인
    if (!hasSystemAdminAccess(currentUserProfile.role)) {
      return NextResponse.json(
        { error: 'Organizations 데이터를 시딩할 권한이 없습니다. (Master 또는 Emergency Center Admin 필요)' },
        { status: 403 }
      );
    }

    // 기존 데이터 확인
    const existingCount = await prisma.organizations.count();

    console.log(`📊 기존 organizations 데이터: ${existingCount}개`);

    // 데이터 생성 (중앙집중식 팩토리 사용)
    const organizationsToInsert = generateSeedOrganizations();

    console.log(`🏭 팩토리에서 생성된 조직 데이터: ${organizationsToInsert.length}개`);

    // 데이터 삽입 (createMany 사용)
    const result = await prisma.organizations.createMany({
      data: organizationsToInsert as any,
      skipDuplicates: true, // 중복은 무시
    });

    // 최종 개수 확인
    const finalCount = await prisma.organizations.count();

    console.log(`✅ Organizations 시딩 완료: ${finalCount}개`);

    return NextResponse.json({
      success: true,
      message: 'Organizations 데이터가 성공적으로 시딩되었습니다.',
      data: {
        before: existingCount,
        after: finalCount,
        inserted: result.count,
        regions: 17,  // 중앙 제외
        dataSource: 'factory',  // 데이터 출처 표시
      },
    });

  } catch (error) {
    console.error('❌ Organizations 시딩 실패:', error);

    return NextResponse.json(
      {
        error: 'Organizations 시딩 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
