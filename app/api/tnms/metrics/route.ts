/**
 * TNMS 메트릭 조회 API
 * GET /api/tnms/metrics
 *
 * 일일 매칭 성공률, 신호 기여도, 커버리지 등 메트릭 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const metric_type = searchParams.get('metric_type'); // all, summary, signals

    // 날짜 검증
    let startDate = new Date();
    let endDate = new Date();

    if (start_date) {
      const parsed = new Date(start_date);
      if (!isNaN(parsed.getTime())) {
        startDate = parsed;
      }
    } else {
      // 기본값: 최근 30일
      startDate.setDate(startDate.getDate() - 30);
    }

    if (end_date) {
      const parsed = new Date(end_date);
      if (!isNaN(parsed.getTime())) {
        endDate = parsed;
      }
    }

    // 메트릭 데이터 조회
    const [
      metrics,
      validationLogs,
      institutionStats,
      successRateAnalysis,
    ] = await Promise.all([
      // 일일 메트릭
      prisma.institution_metrics.findMany({
        where: {
          metric_date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { metric_date: 'desc' },
      }),

      // 검증 로그 통계
      prisma.institution_validation_log.groupBy({
        by: ['is_successful'],
        where: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: true,
      }),

      // 기관 통계
      prisma.institution_registry.groupBy({
        by: ['region_code'],
        _count: {
          standard_code: true,
        },
      }),

      // 신호별 성공률
      prisma.institution_validation_log.findMany({
        where: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
          is_successful: true,
        },
        take: 100, // 샘플
      }),
    ]);

    // 통계 계산
    const totalValidations = validationLogs.reduce((sum, log) => sum + log._count, 0);
    const successCount = validationLogs.find((log) => log.is_successful)?._count || 0;
    const failureCount = validationLogs.find((log) => !log.is_successful)?._count || 0;

    const overallSuccessRate =
      totalValidations > 0
        ? ((successCount / totalValidations) * 100).toFixed(2)
        : '0.00';

    // 신호 기여도 분석
    const signalAnalysis: Record<string, any> = {};
    const signalCounts: Record<string, number> = {};

    for (const log of successRateAnalysis) {
      if (log.debug_signals && typeof log.debug_signals === 'object') {
        const signals = log.debug_signals as Record<string, any>;
        if (signals.match_signals && Array.isArray(signals.match_signals)) {
          for (const signal of signals.match_signals) {
            const name = signal.signal_name;
            if (!signalCounts[name]) {
              signalCounts[name] = 0;
              signalAnalysis[name] = {
                count: 0,
                avg_contribution: 0,
                max_value: 0,
              };
            }
            signalCounts[name]++;
            signalAnalysis[name].count++;
            signalAnalysis[name].avg_contribution +=
              signal.contribution || 0;
            signalAnalysis[name].max_value = Math.max(
              signalAnalysis[name].max_value,
              signal.signal_value || 0
            );
          }
        }
      }
    }

    // 평균 계산
    for (const name in signalAnalysis) {
      const count = signalAnalysis[name].count;
      signalAnalysis[name].avg_contribution =
        (signalAnalysis[name].avg_contribution / count).toFixed(2);
    }

    // 응답 형식화
    return NextResponse.json(
      {
        success: true,
        data: {
          period: {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
            days: Math.ceil(
              (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
            ),
          },
          summary: {
            total_validations: totalValidations,
            success_count: successCount,
            failure_count: failureCount,
            success_rate: `${overallSuccessRate}%`,
          },
          daily_metrics:
            metric_type !== 'signals'
              ? metrics.map((m) => ({
                  metric_date: m.metric_date.toISOString().split('T')[0],
                  total_institutions: m.total_institutions,
                  total_aliases: m.total_aliases,
                  matched_count: m.matched_count,
                  unmatched_count: m.unmatched_count,
                  match_success_rate: m.match_success_rate?.toString() || '0',
                  auto_recommend_success_rate:
                    m.auto_recommend_success_rate?.toString() || '0',
                  search_hit_rate: m.search_hit_rate?.toString() || '0',
                  address_match_rate: m.address_match_rate?.toString() || '0',
                  validation_run_count: m.validation_run_count,
                }))
              : [],
          signal_analysis:
            metric_type !== 'summary' ? signalAnalysis : {},
          institution_coverage:
            metric_type !== 'signals'
              ? institutionStats.map((stat) => ({
                  region_code: stat.region_code || 'unknown',
                  institution_count: stat._count.standard_code,
                }))
              : [],
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('TNMS metrics error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST: 새로운 메트릭 기록
 * (관리자용 - 수동 메트릭 계산)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metric_date } = body;

    if (!metric_date) {
      return NextResponse.json(
        { error: 'metric_date is required (YYYY-MM-DD format)' },
        { status: 400 }
      );
    }

    // TNMS 서비스의 recordMetrics 호출
    const { tnmsService } = await import('@/lib/services/tnms');
    await tnmsService.recordMetrics(new Date(metric_date));

    return NextResponse.json(
      {
        success: true,
        message: `Metrics recorded for ${metric_date}`,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('TNMS metrics recording error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
