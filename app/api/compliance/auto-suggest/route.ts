import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/compliance/auto-suggest
 *
 * TNMS 매칭 결과 기반 자동추천 API
 * target_key를 받아서 매칭된 AED 후보를 신뢰도 순으로 반환
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const targetKey = searchParams.get('target_key');
    const limit = parseInt(searchParams.get('limit') || '3');

    if (!targetKey) {
      return NextResponse.json({ error: 'target_key is required' }, { status: 400 });
    }

    // TNMS 매칭 결과 조회 (뷰 사용으로 항상 최신 데이터)
    const matchingResult = await prisma.$queryRaw<any[]>`
      SELECT
        tmr.target_key,
        tmr.target_institution_name,
        tmr.target_address,
        tmr.current_management_number,
        tmr.matched_equipment_serial,
        tmr.current_institution_name,
        tmr.current_address,
        tmr.confidence_score,
        tmr.name_confidence,
        tmr.address_confidence,
        tmr.matching_rules,
        tmr.data_changed,
        ad.installation_position,
        ad.installation_detail,
        ad.sido,
        ad.gugun
      FROM aedpics.tnms_matching_current tmr
      LEFT JOIN aedpics.aed_data ad ON tmr.matched_equipment_serial = ad.equipment_serial
      WHERE tmr.target_key = ${targetKey}
    `;

    if (matchingResult.length === 0) {
      // 매칭 결과가 없으면 유사한 이름으로 검색
      const target = await prisma.target_list_2025.findUnique({
        where: { target_key: targetKey }
      });

      if (!target) {
        return NextResponse.json({
          error: 'Target not found',
          targetKey
        }, { status: 404 });
      }

      // 유사 이름 검색 (폴백)
      const similarAeds = await prisma.$queryRaw<any[]>`
        SELECT
          equipment_serial,
          management_number,
          installation_institution as institution_name,
          installation_address as address,
          installation_position,
          sido,
          gugun,
          similarity(installation_institution, ${target.institution_name}) as name_similarity
        FROM aedpics.aed_data
        WHERE
          sido = ${target.sido}
          AND similarity(installation_institution, ${target.institution_name}) > 0.3
        ORDER BY name_similarity DESC
        LIMIT ${limit}
      `;

      return NextResponse.json({
        targetKey,
        targetName: target.institution_name,
        matchType: 'fallback',
        suggestions: similarAeds.map(aed => ({
          equipment_serial: aed.equipment_serial,
          management_number: aed.management_number,
          institution_name: aed.institution_name,
          address: aed.address,
          confidence_score: Math.round(aed.name_similarity * 100),
          match_reason: 'name_similarity'
        }))
      });
    }

    const match = matchingResult[0];

    // 신뢰도별 추천 전략
    let recommendations = [];

    if (match.confidence_score >= 90) {
      // 높은 신뢰도: 단일 추천
      recommendations = [{
        equipment_serial: match.matched_equipment_serial,
        management_number: match.current_management_number,
        institution_name: match.current_institution_name,
        address: match.current_address,
        confidence_score: match.confidence_score,
        match_type: 'high_confidence',
        data_changed: match.data_changed,
        matching_rules: match.matching_rules
      }];
    } else if (match.confidence_score >= 70) {
      // 중간 신뢰도: 주변 후보도 함께 제시
      const nearbyAeds = await prisma.$queryRaw<any[]>`
        SELECT
          equipment_serial,
          management_number,
          installation_institution,
          installation_address,
          installation_position
        FROM aedpics.aed_data
        WHERE
          sido = ${match.sido}
          AND gugun = ${match.gugun}
          AND equipment_serial != ${match.matched_equipment_serial}
          AND similarity(installation_institution, ${match.target_institution_name}) > 0.5
        ORDER BY
          similarity(installation_institution, ${match.target_institution_name}) DESC
        LIMIT ${limit - 1}
      `;

      recommendations = [
        {
          equipment_serial: match.matched_equipment_serial,
          management_number: match.current_management_number,
          institution_name: match.current_institution_name,
          address: match.current_address,
          confidence_score: match.confidence_score,
          match_type: 'medium_confidence',
          is_primary: true
        },
        ...nearbyAeds.map(aed => ({
          equipment_serial: aed.equipment_serial,
          management_number: aed.management_number,
          institution_name: aed.installation_institution,
          address: aed.installation_address || aed.installation_position,
          confidence_score: null,
          match_type: 'alternative',
          is_primary: false
        }))
      ];
    } else {
      // 낮은 신뢰도: 여러 후보 제시
      const candidates = await prisma.$queryRaw<any[]>`
        SELECT
          equipment_serial,
          management_number,
          installation_institution,
          installation_address,
          installation_position,
          similarity(installation_institution, ${match.target_institution_name}) as similarity_score
        FROM aedpics.aed_data
        WHERE
          sido = ${match.sido}
          AND (gugun = ${match.gugun} OR gugun IS NULL)
        ORDER BY similarity_score DESC
        LIMIT ${limit}
      `;

      recommendations = candidates.map((aed, index) => ({
        equipment_serial: aed.equipment_serial,
        management_number: aed.management_number,
        institution_name: aed.installation_institution,
        address: aed.installation_address || aed.installation_position,
        confidence_score: Math.round(aed.similarity_score * 100),
        match_type: index === 0 ? 'low_confidence_primary' : 'low_confidence_alternative',
        is_primary: index === 0
      }));
    }

    return NextResponse.json({
      targetKey,
      targetName: match.target_institution_name,
      targetAddress: match.target_address,
      matchType: 'tnms_matching',
      confidenceLevel: match.confidence_score >= 90 ? 'high' :
                       match.confidence_score >= 70 ? 'medium' : 'low',
      suggestions: recommendations,
      metadata: {
        nameConfidence: match.name_confidence,
        addressConfidence: match.address_confidence,
        matchingRules: match.matching_rules,
        dataChanged: match.data_changed,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[AutoSuggest] Error:', error);
    return NextResponse.json(
      { error: '자동추천 조회 실패', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compliance/auto-suggest
 *
 * 사용자가 추천을 수락하여 매칭 확정
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetKey, equipmentSerial, confirmed } = body;

    if (!targetKey || !equipmentSerial) {
      return NextResponse.json({
        error: 'targetKey and equipmentSerial are required'
      }, { status: 400 });
    }

    // 사용자 확인 시 match_type을 'verified'로 업데이트
    if (confirmed) {
      await prisma.tnms_matching_results.update({
        where: { target_key: targetKey },
        data: {
          match_type: 'verified',
          matched_equipment_serial: equipmentSerial,
          updated_by: session.user.email || 'user',
          updated_at: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: '매칭이 확정되었습니다',
        targetKey,
        equipmentSerial
      });
    }

    return NextResponse.json({
      success: false,
      message: '매칭이 취소되었습니다'
    });

  } catch (error) {
    console.error('[AutoSuggest] Confirm error:', error);
    return NextResponse.json(
      { error: '매칭 확정 실패' },
      { status: 500 }
    );
  }
}