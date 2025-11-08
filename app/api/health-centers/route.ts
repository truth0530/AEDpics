import { NextResponse } from 'next/server';
import { getAvailableRegions, getAvailableCenters } from '@/lib/data/health-centers-master';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');

    // 중앙관리 시스템 데이터 사용 (동적 생성)
    if (region) {
      const centers = getAvailableCenters(region);
      return NextResponse.json({
        centers: centers,
        total: centers.length - 1, // '기타' 제외
        source: 'factory' // 데이터 소스: 중앙관리 팩토리
      });
    }

    // region이 없으면 전체 보건소 목록 반환
    return NextResponse.json({
      centers: ['기타 (직접 입력)'],
      total: 0,
      source: 'factory'
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 모든 지역 목록 가져오기
export async function POST() {
  try {
    // 중앙관리 시스템에서 동적으로 가져오기
    const regions = getAvailableRegions();
    return NextResponse.json({
      regions: regions,
      total: regions.length,
      source: 'factory' // 데이터 소스: 중앙관리 팩토리
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}