import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma';
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name) {
      return NextResponse.json({ error: '조직명을 입력해주세요' }, { status: 400 })
    }

    // 조직 검색 (정확히 일치하거나 유사한 이름)
    const organization = await prisma.organizations.findFirst({
      where: {
        OR: [
          { name: name },
          { name: { contains: name, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        region_code: true
      }
    })

    if (!organization) {
      return NextResponse.json({ error: '조직을 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json(organization)
  } catch (error) {
    console.error('조직 검색 오류:', error)
    return NextResponse.json({ error: '조직 검색 중 오류가 발생했습니다' }, { status: 500 })
  }
}
