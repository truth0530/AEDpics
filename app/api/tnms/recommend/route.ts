/**
 * TNMS 추천 API
 * POST /api/tnms/recommend
 *
 * 기관명을 입력받아 자동 추천 기관 목록 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { tnmsService } from '@/lib/services/tnms';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      institution_name,
      region_code,
      address,
      limit = 5,
    } = body;

    // 입력 검증
    if (!institution_name || typeof institution_name !== 'string') {
      return NextResponse.json(
        { error: 'institution_name is required and must be a string' },
        { status: 400 }
      );
    }

    if (institution_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'institution_name cannot be empty' },
        { status: 400 }
      );
    }

    if (limit && (typeof limit !== 'number' || limit < 1 || limit > 20)) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 20' },
        { status: 400 }
      );
    }

    // TNMS 서비스 호출
    const result = await tnmsService.normalizeAndMatch(
      institution_name.trim(),
      address,
      region_code,
      'api_recommend'
    );

    // 응답 형식화
    return NextResponse.json(
      {
        success: true,
        data: {
          input: {
            institution_name,
            region_code: region_code || null,
            address: address || null,
          },
          normalization: {
            original: result.source_name,
            normalized: result.normalized_name,
            signals: result.normalization_signals.map((s) => ({
              rule_id: s.rule_id,
              rule_name: s.rule_name,
              applied: s.applied,
            })),
          },
          recommendations: result.recommendations.slice(0, limit).map((rec) => ({
            standard_code: rec.standard_code,
            canonical_name: rec.canonical_name,
            confidence_score: rec.confidence_score,
            recommendation: rec.recommendation,
            signals: rec.match_signals.map((s) => ({
              name: s.signal_name,
              value: s.signal_value,
              weight: s.weight,
              contribution: s.contribution,
            })),
          })),
          best_match: result.best_match
            ? {
                standard_code: result.best_match.standard_code,
                canonical_name: result.best_match.canonical_name,
                confidence_score: result.best_match.confidence_score,
                recommendation: result.best_match.recommendation,
              }
            : null,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('TNMS recommend error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process recommendation request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const institution_name = searchParams.get('institution_name');
  const region_code = searchParams.get('region_code');
  const limit = searchParams.get('limit');

  if (!institution_name) {
    return NextResponse.json(
      { error: 'institution_name query parameter is required' },
      { status: 400 }
    );
  }

  // POST로 redirect
  return POST(
    new NextRequest(request, {
      method: 'POST',
      body: JSON.stringify({
        institution_name,
        region_code,
        limit: limit ? parseInt(limit) : 5,
      }),
    })
  );
}
