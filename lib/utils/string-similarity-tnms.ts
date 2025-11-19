/**
 * TNMS 통합 문자열 유사도 계산 모듈
 *
 * IMPORTANT: 지역명 정규화 시 반드시 docs/REGION_MANAGEMENT_RULES.md 참조
 * - 절대 임의로 정규화 규칙을 만들지 말 것
 * - lib/constants/regions.ts의 함수만 사용할 것
 * - TNMS normalization_rules 테이블 기반 정규화 사용
 */

import { textNormalizer } from '@/lib/services/tnms/text-normalizer';
import { addressNormalizer } from '@/lib/services/tnms/address-normalizer';
import type { NormalizationSignal } from '@/lib/services/tnms/text-normalizer';

// 메모이제이션 캐시 (선택적 성능 최적화)
const normalizationCache = new Map<string, {
  normalized: string;
  signals: NormalizationSignal[];
  timestamp: number;
}>();

const CACHE_TTL = 3600000; // 1시간

/**
 * TNMS 기반 텍스트 정규화 (캐싱 포함)
 */
async function normalizeWithCache(text: string): Promise<{
  normalized: string;
  signals: NormalizationSignal[];
}> {
  const cached = normalizationCache.get(text);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return {
      normalized: cached.normalized,
      signals: cached.signals
    };
  }

  const result = await textNormalizer.normalize(text);

  // 캐시 크기 제한 (최대 1000개)
  if (normalizationCache.size > 1000) {
    // 가장 오래된 100개 제거
    const entries = Array.from(normalizationCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 100).forEach(([key]) => normalizationCache.delete(key));
  }

  normalizationCache.set(text, {
    ...result,
    timestamp: now
  });

  return result;
}

/**
 * Levenshtein 거리 계산 (기존 유지)
 */
function levenshteinDistance(s1: string, s2: string): number {
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
 * 기본 문자열 유사도 계산
 */
export function calculateSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;

  const length = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);

  return Math.round((1 - distance / length) * 100);
}

/**
 * 주소 매칭 신뢰도 계산 (하위 호환성 유지)
 *
 * @param address1 - 첫 번째 주소
 * @param address2 - 두 번째 주소
 * @returns 매칭 신뢰도 (0-100)
 */
export async function calculateAddressMatchConfidence(
  address1: string | null | undefined,
  address2: string | null | undefined
): Promise<number> {
  if (!address1 || !address2) return 0;

  const [normalized1, normalized2] = await Promise.all([
    addressNormalizer.normalize(address1),
    addressNormalizer.normalize(address2)
  ]);

  // 주소 해시가 일치하면 100점
  if (normalized1.address_hash === normalized2.address_hash) {
    return 100;
  }

  // 도로명 주소 비교
  const roadSimilarity = calculateSimilarity(
    normalized1.road_address,
    normalized2.road_address
  );

  // 지번 주소 비교
  const lotSimilarity = calculateSimilarity(
    normalized1.lot_address,
    normalized2.lot_address
  );

  // 더 높은 점수 반환
  return Math.max(roadSimilarity, lotSimilarity);
}

/**
 * TNMS 통합 기관명 매칭 신뢰도 계산
 *
 * @param targetName - 타겟 기관명
 * @param aedName - AED 기관명
 * @param targetAddress - 타겟 주소 (선택)
 * @param aedAddress - AED 주소 (선택)
 * @param enableLogging - 정규화 신호 로깅 여부
 * @returns 매칭 신뢰도 (0-100)
 */
export async function calculateInstitutionMatchConfidence(
  targetName: string,
  aedName: string,
  targetAddress?: string,
  aedAddress?: string,
  enableLogging = false
): Promise<{
  confidence: number;
  nameConfidence: number;
  addressConfidence: number;
  signals?: {
    targetSignals: NormalizationSignal[];
    aedSignals: NormalizationSignal[];
    targetAddressSignals?: NormalizationSignal[];
    aedAddressSignals?: NormalizationSignal[];
  };
}> {
  // 기관명 정규화
  const [normalizedTarget, normalizedAed] = await Promise.all([
    normalizeWithCache(targetName),
    normalizeWithCache(aedName)
  ]);

  // 정규화된 텍스트로 유사도 계산
  const nameConfidence = calculateSimilarity(
    normalizedTarget.normalized,
    normalizedAed.normalized
  );

  // 정확히 일치하면 추가 점수
  const exactMatch = normalizedTarget.normalized === normalizedAed.normalized;
  const adjustedNameConfidence = exactMatch ? 100 : nameConfidence;

  // 주소 유사도 계산 (선택적)
  let addressConfidence = 0;
  let addressSignals = undefined;

  if (targetAddress && aedAddress) {
    const [normalizedTargetAddr, normalizedAedAddr] = await Promise.all([
      addressNormalizer.normalize(targetAddress),
      addressNormalizer.normalize(aedAddress)
    ]);

    // 도로명 주소 우선, 없으면 지번 주소 비교
    const targetAddr = normalizedTargetAddr.road_address || normalizedTargetAddr.lot_address;
    const aedAddr = normalizedAedAddr.road_address || normalizedAedAddr.lot_address;

    addressConfidence = calculateSimilarity(targetAddr, aedAddr);

    // 주소 해시가 일치하면 100점
    if (normalizedTargetAddr.address_hash === normalizedAedAddr.address_hash) {
      addressConfidence = 100;
    }

    if (enableLogging) {
      addressSignals = {
        targetAddressSignals: [],
        aedAddressSignals: []
      };
    }
  }

  // 가중 평균 계산
  // 주소가 있으면: 기관명 60%, 주소 40%
  // 주소가 없으면: 기관명 100%
  const finalConfidence = addressConfidence > 0
    ? adjustedNameConfidence * 0.6 + addressConfidence * 0.4
    : adjustedNameConfidence;

  const result: any = {
    confidence: Math.round(finalConfidence),
    nameConfidence: Math.round(adjustedNameConfidence),
    addressConfidence: Math.round(addressConfidence)
  };

  // 신호 로깅 (디버깅/모니터링용)
  if (enableLogging) {
    result.signals = {
      targetSignals: normalizedTarget.signals,
      aedSignals: normalizedAed.signals,
      ...addressSignals
    };

    console.log('[TNMS Matching Debug]', {
      original: { targetName, aedName },
      normalized: {
        target: normalizedTarget.normalized,
        aed: normalizedAed.normalized
      },
      confidence: result
    });
  }

  return result;
}

/**
 * 배치 정규화 API (성능 최적화)
 * 여러 텍스트를 한 번에 정규화
 */
export async function batchNormalize(
  texts: string[]
): Promise<Array<{ normalized: string; signals: NormalizationSignal[] }>> {
  return Promise.all(texts.map(text => normalizeWithCache(text)));
}

/**
 * 캐시 초기화
 */
export function clearNormalizationCache(): void {
  normalizationCache.clear();
  textNormalizer.clearCache();
  addressNormalizer.clearCache();
}

// 주기적 캐시 정리 (선택적)
if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    normalizationCache.forEach((value, key) => {
      if (now - value.timestamp > CACHE_TTL) {
        normalizationCache.delete(key);
      }
    });
  }, CACHE_TTL);
}