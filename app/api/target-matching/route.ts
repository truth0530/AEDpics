import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const year = searchParams.get('year') || '2025';
    const yearSuffix = year === '2025' ? '_2025' : '_2024';
    const confidenceLevel = searchParams.get('confidence_level') || 'all';
    const sido = searchParams.get('sido') || '';
    const search = searchParams.get('search') || '';
    const confirmedOnly = searchParams.get('confirmed_only') === 'true';

    // Build Prisma where clause
    const where: any = {};

    // Confidence level filter
    if (confidenceLevel !== 'all') {
      const confidenceMap: any = {
        high: { gte: 80 },
        medium: { gte: 60, lt: 80 },
        low: { lt: 60 },
      };
      if (confidenceMap[confidenceLevel]) {
        where[`auto_confidence${yearSuffix}`] = confidenceMap[confidenceLevel];
      }
    }

    // Confirmed filter
    if (confirmedOnly) {
      where[`confirmed${yearSuffix}`] = true;
    }

    // Sido filter (via management_number pattern or join)
    // management_number에서 sido 정보를 추출하거나, 별도 join 필요

    // Search filter
    if (search) {
      where.OR = [
        { management_number: { contains: search, mode: 'insensitive' } },
        { [`target_key${yearSuffix}`]: { contains: search, mode: 'insensitive' } },
        { [`auto_suggested${yearSuffix}`]: { contains: search, mode: 'insensitive' } },
      ];
    }

    const data = await prisma.management_number_group_mapping.findMany({
      where,
      select: {
        id: true,
        management_number: true,
        [`target_key${yearSuffix}`]: true,
        [`auto_suggested${yearSuffix}`]: true,
        [`auto_confidence${yearSuffix}`]: true,
        [`auto_matching_reason${yearSuffix}`]: true,
        [`confirmed${yearSuffix}`]: true,
        [`confirmed_by${yearSuffix}`]: true,
        [`confirmed_at${yearSuffix}`]: true,
        [`modified_by${yearSuffix}`]: true,
        [`modified_at${yearSuffix}`]: true,
        [`modification_note${yearSuffix}`]: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: [
        { [`confirmed${yearSuffix}`]: 'desc' },
        { [`auto_confidence${yearSuffix}`]: 'desc' },
      ],
      take: 1000, // Limit for performance
    });

    // Filter by sido if needed (post-processing)
    let filteredData = data;
    if (sido) {
      filteredData = data.filter(item => {
        // Extract sido from auto_suggested or management_number
        const suggested = item[`auto_suggested${yearSuffix}`] || '';
        return suggested.includes(sido);
      });
    }

    return NextResponse.json({
      mappings: filteredData,
      total: filteredData.length,
    });
  } catch (error) {
    console.error('Failed to fetch target matchings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matchings' },
      { status: 500 }
    );
  }
}
