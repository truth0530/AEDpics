/**
 * TNMS 검증 결과 조회 API
 * GET /api/tnms/validate
 *
 * 기관명에 대한 검증 로그 및 상세 정보 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const validation_run_id = searchParams.get('validation_run_id');
    const source_name = searchParams.get('source_name');
    const matched_standard_code = searchParams.get('matched_standard_code');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // 입력 검증
    if (!validation_run_id && !source_name && !matched_standard_code) {
      return NextResponse.json(
        {
          error: 'At least one filter is required: validation_run_id, source_name, or matched_standard_code',
        },
        { status: 400 }
      );
    }

    const pageLimit = limit ? Math.min(parseInt(limit), 100) : 20;
    const pageOffset = offset ? parseInt(offset) : 0;

    // 검증 로그 조회
    const where: any = {};

    if (validation_run_id) {
      where.validation_run_id = validation_run_id;
    }
    if (source_name) {
      where.source_name = { contains: source_name };
    }
    if (matched_standard_code) {
      where.matched_standard_code = matched_standard_code;
    }

    const [logs, total] = await Promise.all([
      prisma.institution_validation_log.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: pageLimit,
        skip: pageOffset,
      }),
      prisma.institution_validation_log.count({ where }),
    ]);

    // 결과 형식화
    const formatted_logs = logs.map((log) => ({
      log_id: log.log_id.toString(),
      validation_run_id: log.validation_run_id,
      run_type: log.run_type,
      source_table: log.source_table,
      source_name: log.source_name,
      matched_standard_code: log.matched_standard_code,
      match_confidence: log.match_confidence,
      is_successful: log.is_successful,
      error_reason: log.error_reason,
      manual_review_status: log.manual_review_status,
      manual_review_notes: log.manual_review_notes,
      debug_signals: log.debug_signals,
      created_at: log.created_at.toISOString(),
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          logs: formatted_logs,
          pagination: {
            total,
            limit: pageLimit,
            offset: pageOffset,
            has_more: pageOffset + pageLimit < total,
          },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('TNMS validate error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve validation logs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      log_id,
      manual_review_status,
      manual_review_notes,
      reviewed_by,
    } = body;

    // 입력 검증
    if (!log_id) {
      return NextResponse.json(
        { error: 'log_id is required' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected', 'pending'].includes(manual_review_status)) {
      return NextResponse.json(
        {
          error: 'manual_review_status must be one of: approved, rejected, pending',
        },
        { status: 400 }
      );
    }

    // 로그 업데이트
    const updated = await prisma.institution_validation_log.update({
      where: { log_id: BigInt(log_id) },
      data: {
        manual_review_status,
        manual_review_notes: manual_review_notes || null,
        reviewed_by: reviewed_by || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          log_id: updated.log_id.toString(),
          manual_review_status: updated.manual_review_status,
          manual_review_notes: updated.manual_review_notes,
          reviewed_by: updated.reviewed_by,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('TNMS validate update error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update validation log',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
