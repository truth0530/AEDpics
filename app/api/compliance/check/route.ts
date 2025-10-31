import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateMatchingScore } from '@/lib/utils/similarity-matching';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

// Optimize query with pagination and limits
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const MAX_AED_MATCHES_PER_TARGET = 5;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') || '2024';
    const sido = searchParams.get('sido');
    const gugun = searchParams.get('gugun');
    const search = searchParams.get('search');
    const confidenceLevel = searchParams.get('confidence_level') || 'all';

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE)),
      MAX_PAGE_SIZE
    );
    const skip = (page - 1) * limit;

    // 1. Count total targets for pagination
    const targetWhere: any = {
      data_year: parseInt(year),
    };

    if (sido) targetWhere.sido = sido;
    if (gugun) targetWhere.gugun = gugun;
    if (search) {
      targetWhere.OR = [
        { institution_name: { contains: search, mode: 'insensitive' } },
        { target_key: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count for pagination metadata
    const totalCount = await prisma.target_list_2024.count({
      where: targetWhere
    });

    // 2. Get paginated target list
    const targetList = await prisma.target_list_2024.findMany({
      where: targetWhere,
      orderBy: [
        { sido: 'asc' },
        { gugun: 'asc' },
        { institution_name: 'asc' }
      ],
      skip,
      take: limit
    });

    if (targetList.length === 0) {
      return NextResponse.json({
        matches: [],
        total: 0,
        page,
        pageSize: limit,
        totalPages: 0,
        totalCount: 0
      });
    }

    // 3. Get existing mappings for current page targets only
    const targetKeys = targetList.map(t => t.target_key);
    const existingMappings = await prisma.management_number_group_mapping.findMany({
      where: {
        [`target_key_${year}`]: {
          in: targetKeys
        }
      }
    });

    // 4. Get relevant AED data with optimized query
    // Only fetch AED data for the regions that have targets in current page
    const uniqueRegions = [...new Set(targetList.map(t => ({ sido: t.sido, gugun: t.gugun })))];

    const aedDataPromises = uniqueRegions.map(region =>
      prisma.aed_data.findMany({
        where: {
          sido: region.sido,
          gugun: region.gugun
        },
        select: {
          management_number: true,
          installation_institution: true,
          sido: true,
          gugun: true,
          installation_location_address: true,
          installation_address: true,
          equipment_serial: true,
        },
        take: 1000 // Limit AED records per region to prevent memory overflow
      })
    );

    const aedDataResults = await Promise.all(aedDataPromises);
    const aedData = aedDataResults.flat();

    // Create a map for faster lookups
    const aedByRegion = new Map<string, any[]>();
    for (const aed of aedData) {
      const key = `${aed.sido}-${aed.gugun}`;
      if (!aedByRegion.has(key)) {
        aedByRegion.set(key, []);
      }
      aedByRegion.get(key)!.push(aed);
    }

    // 5. Process matches for current page only
    const matches = [];

    for (const target of targetList) {
      // Check existing mapping first
      const existingMapping = existingMappings.find(m =>
        m[`target_key_${year}`] === target.target_key
      );

      let targetMatches = [];

      if (existingMapping && existingMapping[`confirmed_${year}`]) {
        // Use confirmed mapping
        const managementNumber = existingMapping.management_number;
        const matchedAed = aedData.find(a => a.management_number === managementNumber);

        if (matchedAed) {
          targetMatches.push({
            management_number: managementNumber,
            institution_name: matchedAed.installation_institution || '',
            address: matchedAed.installation_location_address || matchedAed.installation_address || '',
            equipment_count: matchedAed.equipment_serial?.length || 0,
            confidence: parseFloat(existingMapping[`auto_confidence_${year}`]?.toString() || '100'),
            matchingReason: existingMapping[`auto_matching_reason_${year}`] || { confirmed: true },
            confirmed: true
          });
        }
      } else {
        // Perform new matching with limited scope
        const regionKey = `${target.sido}-${target.gugun}`;
        const localAedData = aedByRegion.get(regionKey) || [];

        // Limit comparisons to prevent timeout
        const maxComparisons = 100;
        const aedSubset = localAedData.slice(0, maxComparisons);

        const targetAddress = `${target.sido} ${target.gugun}`;

        for (const aed of aedSubset) {
          const result = calculateMatchingScore(
            target.institution_name || '',
            targetAddress,
            aed.installation_institution || '',
            aed.installation_location_address || aed.installation_address || '',
            target.sub_division
          );

          if (result.confidence >= 50) {
            targetMatches.push({
              management_number: aed.management_number || '',
              institution_name: aed.installation_institution || '',
              address: aed.installation_location_address || aed.installation_address || '',
              equipment_count: aed.equipment_serial?.length || 0,
              confidence: result.confidence,
              matchingReason: result.matchingReason,
              confirmed: false
            });
          }
        }

        // Sort by confidence and limit results
        targetMatches.sort((a, b) => b.confidence - a.confidence);
        targetMatches = targetMatches.slice(0, MAX_AED_MATCHES_PER_TARGET);
      }

      // Apply confidence filter
      if (confidenceLevel !== 'all' && targetMatches.length > 0) {
        const topMatch = targetMatches[0];
        if (confidenceLevel === 'high' && topMatch.confidence < 90) continue;
        if (confidenceLevel === 'medium' && (topMatch.confidence < 60 || topMatch.confidence >= 90)) continue;
        if (confidenceLevel === 'low' && topMatch.confidence >= 60) continue;
      }

      // Determine status
      let status: 'installed' | 'not_installed' | 'pending' = 'pending';
      if (existingMapping && existingMapping[`confirmed_${year}`]) {
        status = targetMatches.length > 0 ? 'installed' : 'not_installed';
      }

      matches.push({
        targetInstitution: {
          target_key: target.target_key,
          institution_name: target.institution_name,
          sido: target.sido,
          gugun: target.gugun,
          division: target.division,
          sub_division: target.sub_division
        },
        matches: targetMatches,
        status,
        confirmedBy: existingMapping?.[`confirmed_by_${year}`],
        confirmedAt: existingMapping?.[`confirmed_at_${year}`],
        note: existingMapping?.[`modification_note_${year}`]
      });
    }

    // Return paginated response
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      matches,
      total: matches.length,
      page,
      pageSize: limit,
      totalPages,
      totalCount,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    });

  } catch (error) {
    console.error('Compliance check error:', error);

    // More specific error handling
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return NextResponse.json(
          { error: 'Database query timeout. Please try with fewer records or more specific filters.' },
          { status: 504 }
        );
      }

      if (error.message.includes('out of memory')) {
        return NextResponse.json(
          { error: 'Too much data to process. Please apply more filters.' },
          { status: 507 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to check compliance' },
      { status: 500 }
    );
  }
}

// New endpoint for batch operations
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetKeys, year = '2024', operation } = body;

    if (!targetKeys || !Array.isArray(targetKeys) || targetKeys.length === 0) {
      return NextResponse.json({ error: 'Invalid target keys' }, { status: 400 });
    }

    // Limit batch size to prevent timeout
    const MAX_BATCH_SIZE = 100;
    if (targetKeys.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
        { status: 400 }
      );
    }

    // Process batch operations
    if (operation === 'confirm') {
      // Batch confirm implementation
      const results = await prisma.management_number_group_mapping.updateMany({
        where: {
          [`target_key_${year}`]: { in: targetKeys }
        },
        data: {
          [`confirmed_${year}`]: true,
          [`confirmed_by_${year}`]: session.user?.email,
          [`confirmed_at_${year}`]: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        updated: results.count
      });
    }

    return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });

  } catch (error) {
    console.error('Batch operation error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch operation' },
      { status: 500 }
    );
  }
}