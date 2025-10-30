import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateMatchingScore, performBatchMatching } from '@/lib/utils/similarity-matching';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

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

    // 1. target_list_2024 데이터 조회
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

    const targetList = await prisma.target_list_2024.findMany({
      where: targetWhere,
      orderBy: [
        { sido: 'asc' },
        { gugun: 'asc' },
        { institution_name: 'asc' }
      ]
    });

    // 2. 기존 매칭 데이터 조회
    const existingMappings = await prisma.management_number_group_mapping.findMany({
      where: {
        [`target_key_${year}`]: {
          in: targetList.map(t => t.target_key)
        }
      }
    });

    // 3. AED 데이터 조회 (동일 지역)
    const aedDataWhere: any = {};
    if (sido) aedDataWhere.sido = sido;
    if (gugun) aedDataWhere.sigungu = gugun;

    const aedData = await prisma.aed_data.findMany({
      where: aedDataWhere,
      select: {
        management_number: true,
        installation_institution: true,
        sido: true,
        gugun: true,
        installation_location_address: true,
        installation_address: true,
        equipment_serial: true,
      }
    });

    // 4. 각 타겟에 대한 매칭 수행
    const matches = [];

    for (const target of targetList) {
      // 기존 매칭 확인
      const existingMapping = existingMappings.find(m =>
        m[`target_key_${year}`] === target.target_key
      );

      let targetMatches = [];

      if (existingMapping) {
        // 기존 매칭 데이터 사용
        const managementNumber = existingMapping.management_number;
        const matchedAed = aedData.find(a => a.management_number === managementNumber);

        if (matchedAed) {
          targetMatches.push({
            management_number: managementNumber,
            institution_name: matchedAed.installation_institution || '',
            address: matchedAed.installation_location_address || matchedAed.installation_address || '',
            equipment_count: matchedAed.equipment_serial?.length || 0,
            confidence: parseFloat(existingMapping[`auto_confidence_${year}`]?.toString() || '0'),
            matchingReason: existingMapping[`auto_matching_reason_${year}`] || {},
            confirmed: existingMapping[`confirmed_${year}`] || false
          });
        }
      } else {
        // 새로운 매칭 수행
        const targetAddress = `${target.sido} ${target.gugun}`;
        const localAedData = aedData.filter(aed =>
          aed.sido === target.sido && aed.gugun === target.gugun
        );

        for (const aed of localAedData) {
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

        // 신뢰도 순으로 정렬
        targetMatches.sort((a, b) => b.confidence - a.confidence);
        targetMatches = targetMatches.slice(0, 10); // 상위 10개만
      }

      // 신뢰도 필터 적용
      if (confidenceLevel !== 'all' && targetMatches.length > 0) {
        const topMatch = targetMatches[0];
        if (confidenceLevel === 'high' && topMatch.confidence < 90) continue;
        if (confidenceLevel === 'medium' && (topMatch.confidence < 60 || topMatch.confidence >= 90)) continue;
        if (confidenceLevel === 'low' && topMatch.confidence >= 60) continue;
      }

      // 설치 상태 확인
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

    return NextResponse.json({
      matches,
      total: matches.length
    });

  } catch (error) {
    console.error('Compliance check error:', error);
    return NextResponse.json(
      { error: 'Failed to check compliance' },
      { status: 500 }
    );
  }
}