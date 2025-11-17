import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { normalizeGugunForDB, normalizeRegionName } from '@/lib/constants/regions';
import { getDisplayAddress } from '@/lib/utils/aed-address-helpers';

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
    const year = '2025'; // Only 2025 data is supported
    const sidoParam = searchParams.get('sido');
    // target_list_2025는 약칭("대구", "서울")으로 저장되어 있으므로
    // normalizeRegionName으로 정식명칭 → 약칭 변환
    const sido = sidoParam ? normalizeRegionName(sidoParam) : undefined;
    const gugunParam = searchParams.get('gugun');
    const gugun = gugunParam ? (normalizeGugunForDB(gugunParam) ?? gugunParam) : undefined;
    const search = searchParams.get('search');
    const subDivision = searchParams.get('sub_division');

    // 미매칭만 필터 파라미터 (기본값: true)
    const showOnlyUnmatched = searchParams.get('showOnlyUnmatched') !== 'false';

    if (subDivision) {
      console.log('[ComplianceAPI] Received sub_division filter:', subDivision);
    }

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
    if (subDivision) {
      targetWhere.sub_division = subDivision;
      console.log('[ComplianceAPI] WHERE clause includes sub_division:', subDivision);
    }
    if (search) {
      targetWhere.OR = [
        { institution_name: { contains: search, mode: 'insensitive' } },
        { target_key: { contains: search, mode: 'insensitive' } },
        { unique_key: { contains: search, mode: 'insensitive' } }
      ];
    }

    console.log('[ComplianceAPI] Final WHERE clause:', JSON.stringify(targetWhere));

    // Check cache for count
    const cacheKey = JSON.stringify(targetWhere);
    let totalCount = 0;

    const cached = countCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      totalCount = cached.value;
    } else {
      // Count with timeout
      const countPromise = prisma.target_list_2025.count({ where: targetWhere });

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
    const targetList = await prisma.target_list_2025.findMany({
      where: targetWhere,
      select: {
        target_key: true,
        institution_name: true,
        sido: true,
        gugun: true,
        division: true,
        sub_division: true,
        unique_key: true,
        address: true,
      },
      orderBy: [
        { sido: 'asc' },
        { gugun: 'asc' },
        { address: 'asc' },
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

    // Get matched institutions from target_list_devices (새로운 매칭 시스템)
    const targetKeys = targetList.map(t => t.target_key);
    const matchedDevices = await prisma.target_list_devices.findMany({
      where: {
        target_institution_id: { in: targetKeys },
        target_list_year: parseInt(year)
      },
      select: {
        target_institution_id: true,
        equipment_serial: true,
        matched_by: true,
        matched_at: true,
      }
    });

    // Get unique equipment serials from matched devices
    const equipmentSerials = [...new Set(matchedDevices.map(d => d.equipment_serial))];

    // Get AED data for matched equipment
    const aedData = equipmentSerials.length > 0 ? await prisma.aed_data.findMany({
      where: {
        equipment_serial: { in: equipmentSerials }
      },
      select: {
        equipment_serial: true,
        management_number: true,
        installation_institution: true,
        installation_location_address: true,
        installation_address: true,
      }
    }) : [];

    // Build response with AED data
    const matches = targetList.map(target => {
      const targetMatches = matchedDevices.filter(m =>
        m.target_institution_id === target.target_key
      );

      const matchedAeds = targetMatches.map(tm => {
        const aed = aedData.find(a => a.equipment_serial === tm.equipment_serial);
        return aed ? { ...aed, equipment_serial: tm.equipment_serial } : null;
      }).filter(Boolean);

      // Group by management_number
      const groupedByManagementNumber = matchedAeds.reduce((acc: any, aed: any) => {
        if (!acc[aed.management_number]) {
          acc[aed.management_number] = {
            management_number: aed.management_number,
            institution_name: aed.installation_institution || '',
            address: aed.installation_location_address || aed.installation_address || '',
            equipment_count: 0,
            equipment_serials: [],
            confidence: 100
          };
        }
        acc[aed.management_number].equipment_count++;
        acc[aed.management_number].equipment_serials.push(aed.equipment_serial);
        return acc;
      }, {});

      const matchesArray = Object.values(groupedByManagementNumber);

      return {
        targetInstitution: {
          target_key: target.target_key,
          institution_name: target.institution_name,
          sido: target.sido,
          gugun: target.gugun,
          division: target.division,
          sub_division: target.sub_division,
          unique_key: target.unique_key,
          address: target.address,
        },
        matches: matchesArray,
        status: targetMatches.length > 0 ? 'confirmed' : 'pending',
        confirmedBy: targetMatches[0]?.matched_by,
        confirmedAt: targetMatches[0]?.matched_at,
        requiresMatching: targetMatches.length === 0
      };
    });

    // DEBUG: confirmed 상태인 기관의 matches 배열 확인
    const confirmedMatches = matches.filter(m => m.status === 'confirmed');
    if (confirmedMatches.length > 0) {
      console.log('[ComplianceAPI] Confirmed matches sample:', JSON.stringify({
        count: confirmedMatches.length,
        sample: confirmedMatches.slice(0, 2).map(m => ({
          target_key: m.targetInstitution.target_key,
          institution_name: m.targetInstitution.institution_name,
          matchesArray: m.matches,
          matchesCount: m.matches.length
        }))
      }, null, 2));
    }

    // 미매칭만 필터 적용
    const filteredMatches = showOnlyUnmatched
      ? matches.filter(m => m.status !== 'confirmed')
      : matches;

    console.log('[ComplianceAPI] Filtering stats:', {
      showOnlyUnmatched,
      totalMatches: matches.length,
      confirmedCount: matches.filter(m => m.status === 'confirmed').length,
      pendingCount: matches.filter(m => m.status === 'pending').length,
      afterFilterCount: filteredMatches.length
    });

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / limit) : 0;

    return NextResponse.json({
      matches: filteredMatches,
      total: filteredMatches.length,
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
    const { target_key } = body;

    if (!target_key) {
      return NextResponse.json({ error: 'target_key required' }, { status: 400 });
    }

    // Get target details
    const target = await prisma.target_list_2025.findFirst({
      where: {
        target_key,
        data_year: 2025
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
        address: getDisplayAddress(aed),
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