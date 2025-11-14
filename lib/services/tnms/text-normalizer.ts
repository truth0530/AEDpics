import { prisma } from '@/lib/prisma';

export interface NormalizationSignal {
  rule_id: number;
  rule_name: string;
  applied: boolean;
  before: string;
  after: string;
}

/**
 * 텍스트 정규화 서비스
 * normalization_rules 테이블의 규칙을 우선순위 순으로 적용
 */
export class TextNormalizer {
  private rulesCache: any[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 3600000; // 1시간

  /**
   * 정규화 규칙 캐싱 (자동 갱신)
   */
  private async getRules() {
    const now = Date.now();
    if (!this.rulesCache || now - this.cacheTimestamp > this.CACHE_TTL) {
      const rules = await prisma.normalization_rules.findMany({
        where: { is_active: true },
        orderBy: { priority: 'desc' },
      });
      this.rulesCache = rules;
      this.cacheTimestamp = now;
    }
    return this.rulesCache || [];
  }

  /**
   * 공통 접사 제거 (예: "센터", "지원센터", "보건소" 등)
   */
  private removeSuffixes(text: string, patterns: string[]): string {
    let result = text;
    for (const pattern of patterns) {
      const regex = new RegExp(`${pattern}$`);
      result = result.replace(regex, '');
    }
    return result;
  }

  /**
   * 지역명 약칭 정규화 (예: "서울" -> "서울특별시")
   */
  private expandRegionNames(text: string, mappings: Record<string, string>): string {
    let result = text;
    for (const [short, full] of Object.entries(mappings)) {
      const regex = new RegExp(`\\b${short}\\b`, 'g');
      result = result.replace(regex, full);
    }
    return result;
  }

  /**
   * 공백 정규화 (연속 공백 제거, 양끝 공백 제거)
   */
  private normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ') // 연속된 공백을 단일 공백으로
      .trim(); // 양끝 공백 제거
  }

  /**
   * 특수문자 제거
   */
  private removeSpecialCharacters(text: string, excludeChars: string[] = []): string {
    const pattern = `[^가-힣a-zA-Z0-9${excludeChars.map(c => `\\${c}`).join('')}\\s]`;
    return text.replace(new RegExp(pattern, 'g'), '');
  }

  /**
   * 한글 숫자 정규화 (한글 -> 아라비아 숫자)
   */
  private normalizeKoreanNumerals(text: string): string {
    const koreanToArabic: Record<string, string> = {
      '영': '0', '공': '0',
      '일': '1', '한': '1',
      '이': '2', '둘': '2',
      '삼': '3', '셋': '3',
      '사': '4', '넷': '4',
      '오': '5', '다섯': '5',
      '육': '6', '여섯': '6',
      '칠': '7', '일곱': '7',
      '팔': '8', '여덟': '8',
      '구': '9', '아홉': '9',
    };

    let result = text;
    for (const [korean, arabic] of Object.entries(koreanToArabic)) {
      result = result.replace(new RegExp(korean, 'g'), arabic);
    }

    // 전각 숫자를 반각으로 변환
    result = result.replace(/[０-９]/g, (match) => {
      return String.fromCharCode(match.charCodeAt(0) - 0xfee0);
    });

    return result;
  }

  /**
   * 텍스트 정규화 메인 함수
   * @param text 정규화할 텍스트
   * @returns { normalized: 정규화된 텍스트, signals: 적용된 규칙 목록 }
   */
  async normalize(text: string): Promise<{
    normalized: string;
    signals: NormalizationSignal[];
  }> {
    const rules = await this.getRules();
    let result = text;
    const signals: NormalizationSignal[] = [];

    for (const rule of rules) {
      const before = result;
      let applied = false;

      try {
        switch (rule.rule_type) {
          case 'suffix_removal':
            const suffixPatterns = rule.rule_spec.patterns || [];
            const afterSuffix = this.removeSuffixes(result, suffixPatterns);
            applied = afterSuffix !== result;
            result = afterSuffix;
            break;

          case 'region_expansion':
            const mappings = rule.rule_spec.mappings || {};
            const afterRegion = this.expandRegionNames(result, mappings);
            applied = afterRegion !== result;
            result = afterRegion;
            break;

          case 'whitespace_normalize':
            const afterWhitespace = this.normalizeWhitespace(result);
            applied = afterWhitespace !== result;
            result = afterWhitespace;
            break;

          case 'special_char_removal':
            const excludeChars = rule.rule_spec.exclude_chars || [];
            const afterSpecial = this.removeSpecialCharacters(result, excludeChars);
            applied = afterSpecial !== result;
            result = afterSpecial;
            break;

          case 'korean_numeral_normalize':
            const afterNumeral = this.normalizeKoreanNumerals(result);
            applied = afterNumeral !== result;
            result = afterNumeral;
            break;

          case 'address_standardize':
            // 주소 표준화는 AddressNormalizer에서 처리
            applied = false;
            break;

          case 'parallel_rules':
            // 병렬 규칙은 다른 규칙들의 조합
            applied = result !== before;
            break;
        }

        if (applied || result !== before) {
          signals.push({
            rule_id: rule.rule_id,
            rule_name: rule.rule_name,
            applied: true,
            before: before,
            after: result,
          });
        }
      } catch (error) {
        console.error(`Error applying rule ${rule.rule_name}:`, error);
      }
    }

    return {
      normalized: result,
      signals,
    };
  }

  /**
   * 캐시 초기화 (수동 갱신용)
   */
  clearCache() {
    this.rulesCache = null;
    this.cacheTimestamp = 0;
  }
}

export const textNormalizer = new TextNormalizer();
