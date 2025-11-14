import { prisma } from '@/lib/prisma';

/**
 * 매칭 신호 (Signal)
 * 기관명 일치도를 평가하기 위한 개별 신호
 */
export interface MatchSignal {
  signal_name: string;      // 신호명: text_match, name_similarity, address_match 등
  signal_value: number;     // 0-100 신호값
  weight: number;           // 0-1 가중치
  contribution: number;     // 신호의 최종 기여도 (signal_value * weight)
  details: Record<string, any>;  // 추가 상세정보
}

/**
 * 다중 신호 신뢰도 점수 계산 엔진
 *
 * Phase 1 신호:
 * 1. text_match (정확 문자열 일치)
 * 2. name_similarity (유사도 기반 문자 매칭)
 * 3. address_match (주소 기반 매칭)
 * 4. region_code_match (지역 코드 일치)
 * 5. normalization_match (정규화 후 일치도)
 *
 * 최종 점수 = Σ(signal_value × weight) / Σ(weight) * 100
 */
export class ScoreEngine {
  /**
   * Phase 1: 기본 4가지 신호로 점수 계산
   *
   * @param candidate_name 대상 기관명 (정규화됨)
   * @param registry_name 레지스트리 기관명 (정규화됨)
   * @param candidate_address 대상 주소 (해시)
   * @param registry_address 레지스트리 주소 (해시)
   * @param candidate_region 대상 지역 코드
   * @param registry_region 레지스트리 지역 코드
   * @returns { score: 최종점수, signals: 신호 목록, recommendation: 권고사항 }
   */
  async calculateConfidenceScore(
    candidate_name: string,
    registry_name: string,
    candidate_address?: string,
    registry_address?: string,
    candidate_region?: string,
    registry_region?: string
  ): Promise<{
    score: number;
    signals: MatchSignal[];
    recommendation: 'auto_match' | 'manual_review' | 'reject';
    details: {
      matched_signals: number;
      total_signals: number;
      signal_breakdown: MatchSignal[];
    };
  }> {
    const signals: MatchSignal[] = [];

    // Signal 1: 정확 문자열 일치
    const textMatchScore = this.evaluateTextMatch(candidate_name, registry_name);
    signals.push({
      signal_name: 'text_match',
      signal_value: textMatchScore,
      weight: 0.4, // 가장 높은 가중치
      contribution: textMatchScore * 0.4,
      details: {
        candidate: candidate_name,
        registry: registry_name,
        exact_match: textMatchScore === 100,
      },
    });

    // Signal 2: 문자 유사도 (Levenshtein 거리)
    const similarityScore = this.calculateStringSimilarity(
      candidate_name,
      registry_name
    );
    signals.push({
      signal_name: 'name_similarity',
      signal_value: similarityScore,
      weight: 0.25,
      contribution: similarityScore * 0.25,
      details: {
        method: 'levenshtein_distance',
        similarity: similarityScore,
      },
    });

    // Signal 3: 주소 기반 일치
    let addressMatchScore = 0;
    if (candidate_address && registry_address) {
      addressMatchScore = candidate_address === registry_address ? 100 : 0;
    }
    signals.push({
      signal_name: 'address_match',
      signal_value: addressMatchScore,
      weight: 0.2,
      contribution: addressMatchScore * 0.2,
      details: {
        candidate_hash: candidate_address || 'none',
        registry_hash: registry_address || 'none',
        exact_match: addressMatchScore === 100,
      },
    });

    // Signal 4: 지역 코드 일치
    let regionMatchScore = 0;
    if (candidate_region && registry_region) {
      regionMatchScore = candidate_region === registry_region ? 100 : 0;
    }
    signals.push({
      signal_name: 'region_code_match',
      signal_value: regionMatchScore,
      weight: 0.15,
      contribution: regionMatchScore * 0.15,
      details: {
        candidate: candidate_region || 'none',
        registry: registry_region || 'none',
        exact_match: regionMatchScore === 100,
      },
    });

    // 최종 점수 계산
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const totalContribution = signals.reduce((sum, s) => sum + s.contribution, 0);
    const finalScore = totalWeight > 0 ? (totalContribution / totalWeight) * 100 : 0;

    // 권고사항 결정 (임계값 기반)
    const matchedSignals = signals.filter((s) => s.signal_value >= 80).length;
    let recommendation: 'auto_match' | 'manual_review' | 'reject';

    if (finalScore >= 95 && matchedSignals >= 3) {
      recommendation = 'auto_match'; // 높은 신뢰도
    } else if (finalScore >= 70) {
      recommendation = 'manual_review'; // 검토 필요
    } else {
      recommendation = 'reject'; // 낮은 신뢰도
    }

    return {
      score: Math.round(finalScore),
      signals,
      recommendation,
      details: {
        matched_signals: matchedSignals,
        total_signals: signals.length,
        signal_breakdown: signals,
      },
    };
  }

  /**
   * Signal: 정확 문자열 일치
   */
  private evaluateTextMatch(str1: string, str2: string): number {
    const normalized1 = str1.toLowerCase().trim();
    const normalized2 = str2.toLowerCase().trim();

    if (normalized1 === normalized2) {
      return 100;
    }

    // 한쪽이 다른 쪽을 포함하는 경우 80점
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 80;
    }

    return 0;
  }

  /**
   * Signal: 문자 유사도 (Levenshtein 거리 기반)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;
    if (!s1 || !s2) return 0;

    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);

    return Math.round((1 - distance / maxLength) * 100);
  }

  /**
   * Levenshtein 거리 계산
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * 신호 기반 기관 자동 매칭
   * 신뢰도 점수를 바탕으로 자동 매칭 추천
   */
  async getAutoRecommendations(
    source_name: string,
    limit: number = 5
  ): Promise<
    Array<{
      standard_code: string;
      canonical_name: string;
      score: number;
      recommendation: 'auto_match' | 'manual_review' | 'reject';
    }>
  > {
    // institution_registry에서 상위 후보 검색
    const candidates = await prisma.institution_registry.findMany({
      where: { is_active: true },
      take: limit * 2, // 필터링 전 여유있게 조회
    });

    const recommendations = [];

    for (const candidate of candidates) {
      const result = await this.calculateConfidenceScore(
        source_name,
        candidate.canonical_name,
        undefined,
        candidate.address_hash,
        undefined,
        candidate.region_code
      );

      if (result.score >= 70) {
        // 70점 이상만 추천
        recommendations.push({
          standard_code: candidate.standard_code,
          canonical_name: candidate.canonical_name,
          score: result.score,
          recommendation: result.recommendation,
        });
      }
    }

    // 점수 높은 순으로 정렬
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const scoreEngine = new ScoreEngine();
