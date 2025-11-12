import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth/auth-options';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || '2025';
    const yearSuffix = year === '2025' ? '_2025' : '_2024';

    // Get overall statistics in parallel
    const [mappings, aedCount] = await Promise.all([
      prisma.management_number_group_mapping.findMany({
        select: {
          [`auto_confidence${yearSuffix}`]: true,
          [`confirmed${yearSuffix}`]: true,
          management_number: true,
        },
      }),
      prisma.aed_data.count(),
    ]);

    const totalMappings = mappings.length;
    const confirmedCount = mappings.filter(m => m[`confirmed${yearSuffix}`]).length;
    const pendingCount = totalMappings - confirmedCount;

    const highConfidence = mappings.filter(m => {
      const confidence = m[`auto_confidence${yearSuffix}`] ? Number(m[`auto_confidence${yearSuffix}`]) : 0;
      return confidence >= 90;
    }).length;

    const mediumConfidence = mappings.filter(m => {
      const confidence = m[`auto_confidence${yearSuffix}`] ? Number(m[`auto_confidence${yearSuffix}`]) : 0;
      return confidence >= 70 && confidence < 90;
    }).length;

    const lowConfidence = mappings.filter(m => {
      const confidence = m[`auto_confidence${yearSuffix}`] ? Number(m[`auto_confidence${yearSuffix}`]) : 0;
      return confidence < 70;
    }).length;

    const avgConfidence = totalMappings > 0
      ? mappings.reduce((sum, m) => sum + (m[`auto_confidence${yearSuffix}`] ? Number(m[`auto_confidence${yearSuffix}`]) : 0), 0) / totalMappings
      : 0;

    const stats = {
      total_mappings: totalMappings,
      total_aed_count: aedCount,
      confirmed_count: confirmedCount,
      pending_count: pendingCount,
      high_confidence_count: highConfidence,
      medium_confidence_count: mediumConfidence,
      low_confidence_count: lowConfidence,
      avg_confidence: avgConfidence,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch target matching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
