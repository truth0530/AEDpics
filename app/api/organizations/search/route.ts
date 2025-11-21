import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma';
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || searchParams.get('name')  // 두 파라미터 모두 지원
    const regionCode = searchParams.get('region_code')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!search) {
      return NextResponse.json({ organizations: [] })  // 검색어 없으면 빈 배열 반환
    }

    // 조직 검색 조건
    const whereClause: any = {
      name: { contains: search, mode: 'insensitive' }
    }

    // 지역 필터가 있으면 추가
    if (regionCode) {
      whereClause.region_code = regionCode
    }

    // 여러 조직 검색 (자동완성용)
    const organizations = await prisma.organizations.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        type: true,
        region_code: true
      },
      take: limit,
      orderBy: { name: 'asc' }
    })

    // type 필드가 없는 경우 기본값 설정
    const formattedOrganizations = organizations.map(org => ({
      id: org.id,
      name: org.name,
      type: org.type || (org.name.includes('보건소') ? 'health_center' :
            org.name.includes('응급의료') ? 'emergency_center' :
            org.name.includes('보건복지부') ? 'government' :
            org.name.includes('시') || org.name.includes('도') ? 'regional_office' : 'other'),
      region_code: org.region_code
    }))

    return NextResponse.json({ organizations: formattedOrganizations })
  } catch (error) {
    console.error('조직 검색 오류:', error)
    return NextResponse.json({ error: '조직 검색 중 오류가 발생했습니다' }, { status: 500 })
  }
}
