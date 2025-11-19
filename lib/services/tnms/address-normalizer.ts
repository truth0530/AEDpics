import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// IMPORTANT: 지역명 정규화 시 반드시 docs/REGION_MANAGEMENT_RULES.md 참조
// - 절대 임의로 정규화 규칙을 만들지 말 것
// - lib/constants/regions.ts의 함수만 사용할 것

export interface AddressNormalizationResult {
  road_address: string;
  lot_address: string;
  address_hash: string;
  normalized_fields: {
    road_address: string;
    lot_address: string;
  };
}

/**
 * 주소 정규화 및 해싱 서비스
 * 도로명 주소와 지번 주소를 표준화하고 중복 검증을 위한 해시 생성
 *
 * 주의: 지역명 매핑은 DB의 administrative_regions 테이블에서
 * 동적으로 로드하여 하드코딩을 피합니다
 */
export class AddressNormalizer {
  private regionMappingsCache: Record<string, string> | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 3600000; // 1시간

  /**
   * DB에서 지역명 매핑 로드 (캐싱)
   * administrative_regions 테이블에서 short_name → korean_name 매핑 생성
   */
  private async getRegionMappings(): Promise<Record<string, string>> {
    const now = Date.now();
    if (this.regionMappingsCache && now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.regionMappingsCache;
    }

    try {
      const regions = await prisma.administrative_regions.findMany({
        where: { is_active: true },
        select: { korean_name: true, short_name: true },
      });

      const mappings: Record<string, string> = {};
      for (const region of regions) {
        // short_name → korean_name 매핑
        if (region.short_name && region.korean_name) {
          mappings[region.short_name] = region.korean_name;
        }
        // korean_name 자체도 매핑 (정식명칭 유지)
        mappings[region.korean_name] = region.korean_name;
      }

      this.regionMappingsCache = mappings;
      this.cacheTimestamp = now;
      return mappings;
    } catch (error) {
      console.error('Error loading region mappings:', error);
      // DB 오류 시 빈 객체 반환 (정규화 진행하되 지역명 변환 없이)
      return {};
    }
  }

  /**
   * 도로명 주소 정규화
   * 예: "서울 강서구 화곡동" -> "서울특별시 강서구 화곡동"
   * 지역명 매핑은 DB의 administrative_regions에서 가져옴
   */
  private async normalizeRoadAddress(address: string): Promise<string> {
    if (!address) return '';

    let normalized = address;

    // DB에서 로드한 지역명 매핑 사용
    const regionMappings = await this.getRegionMappings();

    for (const [short, full] of Object.entries(regionMappings)) {
      normalized = normalized.replace(new RegExp(`^${short}\\s*`, 'g'), full + ' ');
    }

    // 특수문자 제거 (마침표, 하이픈, 괄호 제외)
    normalized = normalized.replace(/[^\p{L}\p{N}\s\-().]/gu, '');

    // 연속된 공백 제거 및 양끝 공백 제거
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * 지번 주소 정규화
   * 예: "서울 강서구 화곡동 123번지" -> "서울특별시 강서구 화곡동 123"
   */
  private async normalizeLotAddress(address: string): Promise<string> {
    if (!address) return '';

    let normalized = await this.normalizeRoadAddress(address);

    // "번지" 제거
    normalized = normalized.replace(/번지$/, '');

    // 지번은 숫자로 끝나야 함
    normalized = normalized.replace(/\s+([0-9]+)(?![\p{L}])/gu, ' $1').trim();

    return normalized;
  }

  /**
   * 주소 해싱 (SHA-256)
   * 주소 기반 중복 검증을 위한 일관된 해시값 생성
   */
  private generateAddressHash(
    road_address: string,
    lot_address: string,
    region_code?: string
  ): string {
    const hashInput = [
      road_address.toLowerCase().trim(),
      lot_address.toLowerCase().trim(),
      region_code || '',
    ]
      .filter(Boolean)
      .join('||');

    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * 주소 정규화 메인 함수
   * @param road_address 도로명 주소
   * @param lot_address 지번 주소
   * @param region_code 시군구 코드 (해시 생성에 포함)
   */
  async normalize(
    road_address?: string,
    lot_address?: string,
    region_code?: string
  ): Promise<AddressNormalizationResult> {
    const normalized_road = await this.normalizeRoadAddress(road_address || '');
    const normalized_lot = await this.normalizeLotAddress(lot_address || '');

    const address_hash = this.generateAddressHash(
      normalized_road,
      normalized_lot,
      region_code
    );

    return {
      road_address: normalized_road,
      lot_address: normalized_lot,
      address_hash,
      normalized_fields: {
        road_address: normalized_road,
        lot_address: normalized_lot,
      },
    };
  }

  /**
   * 주소 유사도 계산 (Levenshtein 거리)
   * 정확한 주소 매칭 없을 때 유사도 기반 매칭에 사용
   */
  calculateSimilarity(address1: string, address2: string): number {
    const s1 = address1.toLowerCase().trim();
    const s2 = address2.toLowerCase().trim();

    if (s1 === s2) return 100;
    if (!s1 || !s2) return 0;

    const length = Math.max(s1.length, s2.length);
    const distance = this.levenshteinDistance(s1, s2);

    return Math.round((1 - distance / length) * 100);
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
   * 캐시 초기화 (수동 갱신용)
   */
  clearCache() {
    this.regionMappingsCache = null;
    this.cacheTimestamp = 0;
  }
}

export const addressNormalizer = new AddressNormalizer();
