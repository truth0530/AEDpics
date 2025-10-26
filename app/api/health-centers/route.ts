import { NextResponse } from 'next/server';
import { REGIONS, getHealthCentersByRegion } from '@/lib/data/health-centers-master';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');

    // 하드코딩된 마스터 데이터 사용
    if (region) {
      const centers = getHealthCentersByRegion(region);
      return NextResponse.json({
        centers: centers,
        total: centers.length - 1, // '기타' 제외
        source: 'master' // 데이터 소스 표시
      });
    }

    // region이 없으면 전체 보건소 목록 반환
    return NextResponse.json({
      centers: ['기타 (직접 입력)'],
      total: 0,
      source: 'master'
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 모든 시도 목록 가져오기
export async function POST() {
  try {
    // 하드코딩된 마스터 데이터 사용
    return NextResponse.json({
      regions: REGIONS,
      total: REGIONS.length,
      source: 'master' // 데이터 소스 표시
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}