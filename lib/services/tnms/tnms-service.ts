import { prisma } from '@/lib/prisma';
import { textNormalizer, type NormalizationSignal } from './text-normalizer';
import { addressNormalizer } from './address-normalizer';
import { scoreEngine, type MatchSignal } from './score-engine';
import crypto from 'crypto';

/**
 * TNMS (Trusted Name Matching Service) Phase 1
 *
 * 기관명 정규화 및 신뢰도 기반 자동 매칭 시스템
 *
 * 처리 흐름:
 * 1. 입력 기관명 정규화 (text normalization)
 * 2. 정규화된 기관명으로 유사 기관 검색
 * 3. 다중 신호 기반 신뢰도 점수 계산
 * 4. 신뢰도에 따른 자동/수동 매칭 추천
 * 5. 결과 로깅 및 메트릭 기록
 */
export class TnmsService {
  /**
   * 기관명 정규화 및 신뢰도 점수 계산
   *
   * @param source_name 원본 기관명 (e-gen 데이터 등)
   * @param source_address 원본 주소
   * @param region_code 지역 코드 (optional)
   * @param source_table 출처 테이블명
   * @param validation_run_id 검증 실행 ID (추적용)
   * @returns 정규화 결과 및 매칭 추천
   */
  async normalizeAndMatch(
    source_name: string,
    source_address?: string,
    region_code?: string,
    source_table: string = 'unknown',
    validation_run_id?: string
  ): Promise<{
    source_name: string;
    normalized_name: string;
    normalization_signals: NormalizationSignal[];
    address_hash: string;
    recommendations: Array<{
      standard_code: string;
      canonical_name: string;
      confidence_score: number;
      match_signals: MatchSignal[];
      recommendation: 'auto_match' | 'manual_review' | 'reject';
    }>;
    best_match: {
      standard_code: string;
      canonical_name: string;
      confidence_score: number;
      recommendation: 'auto_match' | 'manual_review' | 'reject';
    } | null;
  }> {
    try {
      // Step 1: 텍스트 정규화
      const normalizedData = await textNormalizer.normalize(source_name);
      const normalized_name = normalizedData.normalized;
      const normalization_signals = normalizedData.signals;

      // Step 2: 주소 해싱
      const addressData = await addressNormalizer.normalize(
        source_address,
        source_address,
        region_code
      );
      const address_hash = addressData.address_hash;

      // Step 3: 유사 기관 후보 검색
      const candidates = await this.findSimilarInstitutions(
        normalized_name,
        region_code,
        5
      );

      // Step 4: 각 후보별 신뢰도 점수 계산
      const recommendations = [];

      for (const candidate of candidates) {
        const scoreResult = await scoreEngine.calculateConfidenceScore(
          normalized_name,
          candidate.canonical_name,
          address_hash,
          candidate.address_hash,
          region_code,
          candidate.region_code
        );

        recommendations.push({
          standard_code: candidate.standard_code,
          canonical_name: candidate.canonical_name,
          confidence_score: scoreResult.score,
          match_signals: scoreResult.signals,
          recommendation: scoreResult.recommendation,
        });
      }

      // 점수 높은 순으로 정렬
      recommendations.sort((a, b) => b.confidence_score - a.confidence_score);

      // Step 5: 최고 점수 추천 선택
      const best_match =
        recommendations.length > 0
          ? {
              standard_code: recommendations[0].standard_code,
              canonical_name: recommendations[0].canonical_name,
              confidence_score: recommendations[0].confidence_score,
              recommendation: recommendations[0].recommendation,
            }
          : null;

      // Step 6: 검증 로그 기록
      if (best_match) {
        await this.logValidation({
          validation_run_id: validation_run_id || crypto.randomUUID(),
          run_type: 'auto_match',
          source_table,
          source_name,
          matched_standard_code: best_match.standard_code,
          match_confidence: best_match.confidence_score,
          is_successful: true,
          debug_signals: {
            normalization_signals,
            match_signals: recommendations[0].match_signals,
            address_hash,
          },
        });
      }

      return {
        source_name,
        normalized_name,
        normalization_signals,
        address_hash,
        recommendations,
        best_match,
      };
    } catch (error) {
      console.error('Error in normalizeAndMatch:', error);
      throw error;
    }
  }

  /**
   * 정규화된 기관명으로 유사 기관 검색
   * institution_registry에서 후보 기관 조회
   */
  private async findSimilarInstitutions(
    normalized_name: string,
    region_code?: string,
    limit: number = 10
  ): Promise<
    Array<{
      standard_code: string;
      canonical_name: string;
      address_hash: string | null;
      region_code: string | null;
    }>
  > {
    // 지역 필터링이 있으면 적용, 없으면 전체 조회
    const where: any = { is_active: true };
    if (region_code) {
      where.region_code = region_code;
    }

    const institutions = await prisma.institution_registry.findMany({
      where,
      select: {
        standard_code: true,
        canonical_name: true,
        address_hash: true,
        region_code: true,
      },
      take: limit * 2, // 추가로 조회 후 필터링
    });

    // 클라이언트 측에서 유사도 기반 필터링
    const results = institutions
      .map((inst) => ({
        ...inst,
        // 간단한 포함도 기반 정렬 (정규화된 이름)
        similarity: this.quickSimilarityScore(
          normalized_name,
          inst.canonical_name
        ),
      }))
      .filter((inst) => inst.similarity > 0) // 일부라도 일치하는 것만
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ similarity, ...inst }) => inst); // similarity 제거

    return results;
  }

  /**
   * 빠른 유사도 점수 (정렬 목적)
   * - 정확 일치: 100
   * - 포함 관계: 80
   * - 공통 토큰: 60
   * - 그 외: 0
   */
  private quickSimilarityScore(name1: string, name2: string): number {
    const n1 = name1.toLowerCase();
    const n2 = name2.toLowerCase();

    if (n1 === n2) return 100;
    if (n1.includes(n2) || n2.includes(n1)) return 80;

    // 공통 토큰 검사 (공백으로 분리)
    const tokens1 = n1.split(/\s+/).filter((t) => t.length > 0);
    const tokens2 = n2.split(/\s+/).filter((t) => t.length > 0);
    const commonTokens = tokens1.filter((t) => tokens2.includes(t)).length;

    if (commonTokens > 0) {
      return Math.round((commonTokens / Math.max(tokens1.length, tokens2.length)) * 60);
    }

    return 0;
  }

  /**
   * 검증 로그 기록
   * institution_validation_log 테이블에 저장
   */
  private async logValidation(data: {
    validation_run_id: string;
    run_type: string;
    source_table: string;
    source_name: string;
    matched_standard_code?: string;
    match_confidence?: number;
    is_successful: boolean;
    debug_signals?: any;
  }) {
    try {
      await prisma.institution_validation_log.create({
        data: {
          validation_run_id: data.validation_run_id,
          run_type: data.run_type,
          source_table: data.source_table,
          source_name: data.source_name,
          matched_standard_code: data.matched_standard_code,
          match_confidence: data.match_confidence,
          is_successful: data.is_successful,
          debug_signals: data.debug_signals as any,
        },
      });
    } catch (error) {
      console.error('Error logging validation:', error);
      // 로깅 오류는 무시하고 진행
    }
  }

  /**
   * 기관 별칭 추가
   * 기존 정규 기관에 대한 별칭/변형명 기록
   */
  async addAlias(
    standard_code: string,
    alias_name: string,
    alias_source?: string,
    address?: string
  ): Promise<void> {
    try {
      // 정규화
      const normalizedData = await textNormalizer.normalize(alias_name);
      const normalized_alias = normalizedData.normalized;

      // 주소 해싱
      const addressData = await addressNormalizer.normalize(address, address);

      await prisma.institution_aliases.create({
        data: {
          standard_code,
          alias_name: normalized_alias,
          alias_source: alias_source || 'manual',
          source_road_address: address,
          normalization_applied: true,
          address_match: addressData.address_hash !== '',
        },
      });
    } catch (error) {
      console.error('Error adding alias:', error);
      throw error;
    }
  }

  /**
   * 기관 검색 및 추천
   * 사용자 입력 기관명에 대해 자동 추천 제공
   */
  async searchAndRecommend(
    search_name: string,
    region_code?: string,
    limit: number = 5
  ): Promise<
    Array<{
      standard_code: string;
      canonical_name: string;
      region_code: string | null;
      confidence_score: number;
    }>
  > {
    try {
      // 정규화
      const normalizedData = await textNormalizer.normalize(search_name);
      const normalized_name = normalizedData.normalized;

      // 후보 검색
      const candidates = await this.findSimilarInstitutions(
        normalized_name,
        region_code,
        limit
      );

      // 점수 계산
      const results = await Promise.all(
        candidates.map(async (candidate) => {
          const scoreResult = await scoreEngine.calculateConfidenceScore(
            normalized_name,
            candidate.canonical_name,
            undefined,
            candidate.address_hash,
            region_code,
            candidate.region_code
          );

          return {
            standard_code: candidate.standard_code,
            canonical_name: candidate.canonical_name,
            region_code: candidate.region_code,
            confidence_score: scoreResult.score,
          };
        })
      );

      // 점수 높은 순으로 정렬
      return results.sort((a, b) => b.confidence_score - a.confidence_score);
    } catch (error) {
      console.error('Error in searchAndRecommend:', error);
      throw error;
    }
  }

  /**
   * 메트릭 기록
   * 일일 매칭 성공률, 검색 히트율 등 기록
   */
  async recordMetrics(metric_date: Date): Promise<void> {
    try {
      const logs = await prisma.institution_validation_log.findMany({
        where: {
          created_at: {
            gte: new Date(metric_date),
            lt: new Date(
              metric_date.getTime() + 24 * 60 * 60 * 1000
            ),
          },
        },
      });

      const successful = logs.filter((l) => l.is_successful).length;
      const total = logs.length;
      const success_rate = total > 0 ? (successful / total) * 100 : 0;

      await prisma.institution_metrics.create({
        data: {
          metric_date: metric_date,
          total_institutions: await prisma.institution_registry.count({
            where: { is_active: true },
          }),
          total_aliases: await prisma.institution_aliases.count({
            where: { is_active: true },
          }),
          matched_count: successful,
          unmatched_count: total - successful,
          match_success_rate: new Decimal(success_rate),
          validation_run_count: total,
        },
      });
    } catch (error) {
      console.error('Error recording metrics:', error);
      // 메트릭 기록 오류는 무시
    }
  }
}

// Decimal 타입 임포트 (Prisma)
import { Decimal } from '@prisma/client/runtime/library';

export const tnmsService = new TnmsService();
