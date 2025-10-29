import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
/**
 * 데이터베이스에서 보건소 정보를 가져와서
 * 하드코딩된 마스터 데이터 파일을 업데이트합니다.
 *
 * 이 API는 관리자만 호출할 수 있어야 합니다.
 */
export async function POST() {
  try {
    // 현재 사용자 권한 확인
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const profile = await prisma.user_profiles.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    // 보건소 데이터 동기화 권한 확인
    const { checkPermission, getPermissionError } = await import('@/lib/auth/permissions');
    if (!profile || !checkPermission(profile.role, 'SYNC_HEALTH_CENTERS')) {
      return NextResponse.json(
        { error: getPermissionError('SYNC_HEALTH_CENTERS') },
        { status: 403 }
      );
    }

    // 데이터베이스에서 모든 보건소 정보 가져오기
    const aedData = await prisma.aed_data.findMany({
      where: {
        jurisdiction_health_center: { not: null },
        sido: { not: null },
      },
      select: {
        sido: true,
        gugun: true,
        jurisdiction_health_center: true,
      },
    });

    // 시도별로 보건소 그룹화
    const healthCentersByRegion = new Map<string, Set<string>>();

    // 시도명 매핑
    const sidoMapping: { [key: string]: string } = {
      '서울': '서울특별시',
      '부산': '부산광역시',
      '대구': '대구광역시',
      '인천': '인천광역시',
      '광주': '광주광역시',
      '대전': '대전광역시',
      '울산': '울산광역시',
      '세종': '세종특별자치시',
      '경기': '경기도',
      '강원': '강원특별자치도',
      '충북': '충청북도',
      '충남': '충청남도',
      '전북': '전라북도',
      '전남': '전라남도',
      '경북': '경상북도',
      '경남': '경상남도',
      '제주': '제주특별자치도'
    };

    aedData.forEach(item => {
      if (!item.sido || !item.jurisdiction_health_center) return;
      const region = sidoMapping[item.sido] || item.sido;
      if (!healthCentersByRegion.has(region)) {
        healthCentersByRegion.set(region, new Set<string>());
      }
      healthCentersByRegion.get(region)!.add(item.jurisdiction_health_center);
    });

    // 데이터 구조화
    const healthCentersData = Array.from(healthCentersByRegion.entries()).map(([region, centers]) => ({
      region,
      centers: Array.from(centers).sort()
    })).sort((a, b) => {
      // REGIONS 배열의 순서대로 정렬
      const regionOrder = [
        '중앙',
        '서울특별시',
        '부산광역시',
        '대구광역시',
        '인천광역시',
        '광주광역시',
        '대전광역시',
        '울산광역시',
        '세종특별자치시',
        '경기도',
        '강원특별자치도',
        '충청북도',
        '충청남도',
        '전라북도',
        '전라남도',
        '경상북도',
        '경상남도',
        '제주특별자치도'
      ];
      return regionOrder.indexOf(a.region) - regionOrder.indexOf(b.region);
    });

    // 중앙 추가 (고정값)
    const finalData = [
      {
        region: '중앙',
        centers: ['보건복지부', '중앙응급의료센터']
      },
      ...healthCentersData.filter(r => r.region !== '중앙')
    ];

    // 파일 업데이트 대신 데이터만 반환
    // 실제 파일 업데이트는 로컬 개발 환경에서 수동으로 수행

    // 통계 정보
    const stats = {
      totalRegions: finalData.length,
      totalHealthCenters: finalData.reduce((sum, r) => sum + r.centers.length, 0),
      regionDetails: finalData.map(r => ({
        region: r.region,
        count: r.centers.length
      })),
      lastUpdated: new Date().toISOString(),
      source: 'database'
    };

    return NextResponse.json({
      success: true,
      message: '데이터베이스에서 보건소 정보를 가져왔습니다.',
      stats,
      data: finalData,
      note: '이 데이터를 health-centers-master.ts 파일에 수동으로 업데이트해주세요.'
    });

  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: '동기화 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}