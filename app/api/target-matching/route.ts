import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const year = searchParams.get('year') || '2024';
    const confidenceLevel = searchParams.get('confidence_level') || 'all';
    const sido = searchParams.get('sido') || '';
    const search = searchParams.get('search') || '';
    const confirmedOnly = searchParams.get('confirmed_only') === 'true';

    // 2025년은 아직 준비 중
    if (year === '2025') {
      return NextResponse.json(
        { error: '2025년 데이터는 준비 중입니다' },
        { status: 404 }
      );
    }

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
        where.auto_confidence_2024 = confidenceMap[confidenceLevel];
      }
    }

    // Confirmed filter
    if (confirmedOnly) {
      where.confirmed_2024 = true;
    }

    // Sido filter (via management_number pattern or join)
    // management_number에서 sido 정보를 추출하거나, 별도 join 필요

    // Search filter
    if (search) {
      where.OR = [
        { management_number: { contains: search, mode: 'insensitive' } },
        { target_key_2024: { contains: search, mode: 'insensitive' } },
        { auto_suggested_2024: { contains: search, mode: 'insensitive' } },
      ];
    }

    const data = await prisma.management_number_group_mapping.findMany({
      where,
      select: {
        id: true,
        management_number: true,
        target_key_2024: true,
        auto_suggested_2024: true,
        auto_confidence_2024: true,
        auto_matching_reason_2024: true,
        confirmed_2024: true,
        confirmed_by_2024: true,
        confirmed_at_2024: true,
        modified_by_2024: true,
        modified_at_2024: true,
        modification_note_2024: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: [
        { confirmed_2024: 'desc' },
        { auto_confidence_2024: 'desc' },
      ],
      take: 1000, // Limit for performance
    });

    // Filter by sido if needed (post-processing)
    let filteredData = data;
    if (sido) {
      filteredData = data.filter(item => {
        // Extract sido from auto_suggested_2024 or management_number
        const suggested = item.auto_suggested_2024 || '';
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
