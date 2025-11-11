import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { normalizeGugunForDB } from '@/lib/constants/regions';

// Ultra-optimized version with minimal data loading
const MINIMAL_PAGE_SIZE = 10; // Start with very small pages
const MAX_PAGE_SIZE = 50;

// Simple in-memory cache for counts (5 minute TTL)
const countCache = new Map<string, { value: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') || '2024';
    const sido = searchParams.get('sido');
    const gugunParam = searchParams.get('gugun');
    const gugun = gugunParam ? (normalizeGugunForDB(gugunParam) ?? gugunParam) : undefined;
    const search = searchParams.get('search');

    // Use smaller page sizes by default
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(MINIMAL_PAGE_SIZE)),
      MAX_PAGE_SIZE
    );
    const skip = (page - 1) * limit;

    // Build where clause
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

    // Check cache for count
    const cacheKey = JSON.stringify(targetWhere);
    let totalCount = 0;

    const cached = countCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      totalCount = cached.value;
    } else {
      // Count with timeout
      const countPromise = prisma.target_list_2024.count({
        where: targetWhere
      });

      // Set a timeout for the count query
      const timeoutPromise = new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error('Count timeout')), 5000)
      );

      try {
        totalCount = await Promise.race([countPromise, timeoutPromise]) as number;
        countCache.set(cacheKey, { value: totalCount, timestamp: Date.now() });
      } catch (error) {
        // If count times out, use estimate
        totalCount = -1; // Indicates count not available
      }
    }

    // Get minimal target list
    const targetList = await prisma.target_list_2024.findMany({
      where: targetWhere,
      select: {
        target_key: true,
        institution_name: true,
        sido: true,
        gugun: true,
        division: true,
        sub_division: true,
      },
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
        totalCount: 0,
        responseTime: Date.now() - startTime
      });
    }

    // Get only confirmed mappings (skip auto-matching for speed)
    const targetKeys = targetList.map(t => t.target_key);
    const existingMappings = await prisma.management_number_group_mapping.findMany({
      where: {
        [`target_key_${year}`]: { in: targetKeys },
        [`confirmed_${year}`]: true // Only get confirmed mappings
      },
      select: {
        [`target_key_${year}`]: true,
        management_number: true,
        [`confirmed_${year}`]: true,
        [`confirmed_by_${year}`]: true,
        [`confirmed_at_${year}`]: true,
      }
    });

    // Build minimal response
    const matches = targetList.map(target => {
      const mapping = existingMappings.find(m =>
        m[`target_key_${year}`] === target.target_key
      );

      return {
        targetInstitution: {
          target_key: target.target_key,
          institution_name: target.institution_name,
          sido: target.sido,
          gugun: target.gugun,
          division: target.division,
          sub_division: target.sub_division
        },
        matches: [], // Don't load AED data unless specifically requested
        status: mapping ? 'confirmed' : 'pending',
        confirmedBy: mapping?.[`confirmed_by_${year}`],
        confirmedAt: mapping?.[`confirmed_at_${year}`],
        requiresMatching: !mapping // Flag for frontend to request matching if needed
      };
    });

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / limit) : 0;

    return NextResponse.json({
      matches,
      total: matches.length,
      page,
      pageSize: limit,
      totalPages,
      totalCount: totalCount > 0 ? totalCount : 'calculating',
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      responseTime: Date.now() - startTime,
      optimized: true // Flag to indicate this is the optimized version
    });

  } catch (error) {
    console.error('Optimized compliance check error:', error);

    // Always return something within 30 seconds
    if (Date.now() - startTime > 29000) {
      return NextResponse.json(
        {
          error: 'Request timeout',
          message: 'Please try with more specific filters or smaller page size',
          responseTime: Date.now() - startTime
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to check compliance' },
      { status: 500 }
    );
  }
}

// Separate endpoint for matching individual targets
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { target_key, year = '2024' } = body;

    if (!target_key) {
      return NextResponse.json({ error: 'target_key required' }, { status: 400 });
    }

    // Get target details
    const target = await prisma.target_list_2024.findFirst({
      where: {
        target_key,
        data_year: parseInt(year)
      }
    });

    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    // Get limited AED data for matching
    const aedData = await prisma.aed_data.findMany({
      where: {
        sido: target.sido,
        gugun: target.gugun
      },
      select: {
        management_number: true,
        installation_institution: true,
        installation_location_address: true,
        installation_address: true,
      },
      take: 100 // Limit to 100 for quick matching
    });

    // Simple name-based matching
    const matches = aedData
      .filter(aed => {
        const aedName = (aed.installation_institution || '').toLowerCase();
        const targetName = (target.institution_name || '').toLowerCase();

        // Simple substring match
        return aedName.includes(targetName) || targetName.includes(aedName);
      })
      .slice(0, 5) // Return top 5 matches
      .map(aed => ({
        management_number: aed.management_number,
        institution_name: aed.installation_institution,
        address: aed.installation_location_address || aed.installation_address,
        confidence: 80, // Simplified confidence
        confirmed: false
      }));

    return NextResponse.json({ matches });

  } catch (error) {
    console.error('Match operation error:', error);
    return NextResponse.json(
      { error: 'Failed to perform matching' },
      { status: 500 }
    );
  }
}