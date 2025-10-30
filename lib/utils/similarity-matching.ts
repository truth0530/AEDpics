/**
 * 의무설치기관과 AED 데이터 간의 고도화된 유사도 매칭 알고리즘
 * 머신러닝 기법을 활용한 정밀 매칭
 */

import { z } from 'zod';

// 매칭 결과 타입 정의
export interface SimilarityResult {
  confidence: number; // 0-100
  matchingReason: {
    nameScore: number;
    addressScore: number;
    keywordBonus: number;
    method: 'exact' | 'partial' | 'fuzzy' | 'keyword';
    details: string[];
  };
}

// 한글 자모 분리 함수
function decomposeHangul(text: string): string {
  const chosung = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const jungsung = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  const jongsung = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const base = code - 0xAC00;
      const cho = Math.floor(base / 588);
      const jung = Math.floor((base % 588) / 28);
      const jong = base % 28;
      result += chosung[cho] + jungsung[jung] + jongsung[jong];
    } else {
      result += text[i];
    }
  }
  return result;
}

// Levenshtein 거리 계산
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str1.length][str2.length];
}

// 문자열 정규화
function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/\s+/g, ' ')
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '')
    .trim()
    .toLowerCase();
}

// 기관 유형별 키워드 및 동의어 사전
const institutionKeywords: Record<string, {
  keywords: string[];
  weight: number;
  synonyms?: Record<string, string[]>;
}> = {
  // 의료기관
  '의료기관': {
    keywords: ['병원', '의원', '클리닉', '의료원', '치과', '한방', '요양'],
    weight: 1.2,
    synonyms: {
      '병원': ['H', '호스피탈', 'HOSPITAL', '메디컬'],
      '의원': ['C', '클리닉', 'CLINIC'],
      '요양원': ['요양', 'NH', '너싱홈'],
      '요양병원': ['요양H', '요양병원', 'NH'],
      '치과': ['덴탈', 'DENTAL', '치과병원', '치과의원'],
      '한방': ['한의원', '한의', '한방병원'],
    }
  },
  // 교정시설
  '교정시설': {
    keywords: ['교도소', '구치소', '소년원', '보호관찰소'],
    weight: 1.3,
    synonyms: {
      '교도소': ['교정시설', '수용시설'],
      '구치소': ['미결수용소'],
    }
  },
  // 공공기관
  '공공기관': {
    keywords: ['시청', '군청', '구청', '도청', '읍사무소', '면사무소', '동주민센터', '보건소'],
    weight: 1.2,
    synonyms: {
      '시청': ['시청사', '시정부'],
      '군청': ['군청사'],
      '구청': ['구청사'],
      '보건소': ['보건지소', '보건진료소'],
    }
  },
  // 소방/구급
  '응급서비스': {
    keywords: ['소방서', '119', '구급대', '안전센터', '구조대'],
    weight: 1.3,
    synonyms: {
      '소방서': ['소방본부', '소방서지역대'],
      '119': ['119안전센터', '119구급대'],
    }
  },
  // 교육시설
  '교육시설': {
    keywords: ['학교', '대학', '대학교', '초등학교', '중학교', '고등학교', '유치원', '어린이집'],
    weight: 1.1,
    synonyms: {
      '초등학교': ['초교', '초등'],
      '중학교': ['중교', '중학'],
      '고등학교': ['고교', '고등'],
      '대학교': ['대학', '대학원', '전문대'],
    }
  },
  // 사업장
  '사업장': {
    keywords: ['(주)', '주식회사', '공장', '공단', '산업', '전자', '화학', '제조', '물류', '센터'],
    weight: 1.0,
    synonyms: {
      '(주)': ['주식회사', '㈜'],
      '공장': ['제조소', '생산시설', '팩토리'],
    }
  },
  // 주거시설
  '주거시설': {
    keywords: ['아파트', 'APT', '주공', '단지', '빌라', '오피스텔', '주상복합'],
    weight: 1.1,
    synonyms: {
      '아파트': ['APT', '아파트단지'],
      '주공': ['LH', '한국토지주택공사'],
    }
  },
  // 교통시설
  '교통시설': {
    keywords: ['역', '터미널', '공항', '항구', '철도', '지하철', 'KTX', '버스'],
    weight: 1.1,
    synonyms: {
      '역': ['역사', '정거장'],
      '터미널': ['버스터미널', '여객터미널'],
      '철도': ['한국철도공사', 'KORAIL', '코레일'],
    }
  },
  // 복지시설
  '복지시설': {
    keywords: ['복지관', '경로당', '노인', '장애인', '재활', '보육', '청소년'],
    weight: 1.1,
    synonyms: {
      '복지관': ['복지센터', '복지시설'],
      '경로당': ['노인정', '노인회관'],
    }
  },
};

// 키워드 검출 및 가중치 계산
function detectKeywords(text: string): { type: string; keywords: string[]; weight: number } {
  const normalized = normalizeString(text);
  const results: { type: string; keywords: string[]; weight: number }[] = [];

  for (const [type, config] of Object.entries(institutionKeywords)) {
    const foundKeywords: string[] = [];

    // 직접 키워드 검색
    for (const keyword of config.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        foundKeywords.push(keyword);
      }
    }

    // 동의어 검색
    if (config.synonyms) {
      for (const [main, synonymList] of Object.entries(config.synonyms)) {
        for (const synonym of synonymList) {
          if (normalized.includes(synonym.toLowerCase())) {
            foundKeywords.push(main);
            break;
          }
        }
      }
    }

    if (foundKeywords.length > 0) {
      results.push({
        type,
        keywords: [...new Set(foundKeywords)],
        weight: config.weight
      });
    }
  }

  // 가장 많은 키워드가 매칭된 유형 반환
  if (results.length > 0) {
    results.sort((a, b) => b.keywords.length - a.keywords.length);
    return results[0];
  }

  return { type: 'unknown', keywords: [], weight: 1.0 };
}

// TF-IDF 기반 중요 단어 추출
function extractImportantTerms(text: string): string[] {
  const normalized = normalizeString(text);
  const tokens = normalized.split(' ').filter(t => t.length > 1);

  // 불용어 제거
  const stopWords = ['의', '를', '을', '에', '에서', '로', '으로', '와', '과', '도', '는', '은', '이', '가'];
  const filtered = tokens.filter(t => !stopWords.includes(t));

  // 빈도수 계산
  const frequency: Record<string, number> = {};
  filtered.forEach(token => {
    frequency[token] = (frequency[token] || 0) + 1;
  });

  // 상위 5개 단어 반환
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term]) => term);
}

// 이름 유사도 계산 (고도화)
export function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeString(name1);
  const norm2 = normalizeString(name2);

  // 1. 완전 일치
  if (norm1 === norm2) return 100;

  // 2. 키워드 검출 및 가중치 적용
  const keywords1 = detectKeywords(name1);
  const keywords2 = detectKeywords(name2);

  let keywordBonus = 0;
  if (keywords1.type === keywords2.type && keywords1.type !== 'unknown') {
    keywordBonus = 15 * keywords1.weight; // 같은 유형이면 보너스
  }

  // 3. 중요 단어 추출 및 비교
  const terms1 = extractImportantTerms(name1);
  const terms2 = extractImportantTerms(name2);
  const commonTerms = terms1.filter(t => terms2.includes(t));
  const termScore = (commonTerms.length / Math.max(terms1.length, terms2.length)) * 30;

  // 4. 포함 관계
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return Math.min(100, 85 + keywordBonus);
  }

  // 5. 동의어 변환 후 비교
  if (keywords1.type !== 'unknown') {
    const config = institutionKeywords[keywords1.type];
    if (config.synonyms) {
      for (const [main, synonymList] of Object.entries(config.synonyms)) {
        let modified1 = norm1;
        let modified2 = norm2;

        for (const synonym of synonymList) {
          modified1 = modified1.replace(new RegExp(synonym.toLowerCase(), 'gi'), main.toLowerCase());
          modified2 = modified2.replace(new RegExp(synonym.toLowerCase(), 'gi'), main.toLowerCase());
        }

        if (modified1 === modified2) {
          return Math.min(100, 80 + keywordBonus);
        }
        if (modified1.includes(modified2) || modified2.includes(modified1)) {
          return Math.min(100, 75 + keywordBonus);
        }
      }
    }
  }

  // 6. 자모 분리 후 거리 계산
  const decomposed1 = decomposeHangul(norm1);
  const decomposed2 = decomposeHangul(norm2);
  const distance = levenshteinDistance(decomposed1, decomposed2);
  const maxLen = Math.max(decomposed1.length, decomposed2.length);

  if (maxLen === 0) return 0;

  const baseScore = (1 - distance / maxLen) * 60;
  const finalScore = baseScore + termScore + keywordBonus;

  return Math.max(0, Math.min(100, finalScore));
}

// 주소 유사도 계산
export function calculateAddressSimilarity(addr1: string, addr2: string): number {
  const norm1 = normalizeString(addr1);
  const norm2 = normalizeString(addr2);

  // 완전 일치
  if (norm1 === norm2) return 100;

  // 주소 토큰화
  const tokens1 = norm1.split(' ').filter(t => t.length > 0);
  const tokens2 = norm2.split(' ').filter(t => t.length > 0);

  // 공통 토큰 계산
  let commonTokens = 0;
  for (const token1 of tokens1) {
    if (tokens2.some(token2 => token1 === token2 || token1.includes(token2) || token2.includes(token1))) {
      commonTokens++;
    }
  }

  const maxTokens = Math.max(tokens1.length, tokens2.length);
  if (maxTokens === 0) return 0;

  return (commonTokens / maxTokens) * 100;
}

// 종합 매칭 점수 계산 (머신러닝 기법 적용)
export function calculateMatchingScore(
  targetName: string,
  targetAddress: string,
  aedName: string,
  aedAddress: string,
  targetSubDivision?: string
): SimilarityResult {
  const nameScore = calculateNameSimilarity(targetName, aedName);
  const addressScore = calculateAddressSimilarity(targetAddress, aedAddress);

  // 키워드 기반 추가 보너스
  const targetKeywords = detectKeywords(targetName);
  const aedKeywords = detectKeywords(aedName);
  let keywordBonus = 0;

  if (targetKeywords.type === aedKeywords.type && targetKeywords.type !== 'unknown') {
    keywordBonus = 10 * targetKeywords.weight;
  }

  // 분류 정보가 있으면 추가 보너스
  if (targetSubDivision) {
    const divisionKeywords = detectKeywords(targetSubDivision);
    if (divisionKeywords.type === aedKeywords.type) {
      keywordBonus += 5;
    }
  }

  const details: string[] = [];
  let method: 'exact' | 'partial' | 'fuzzy' | 'keyword' = 'fuzzy';

  // 가중 평균 계산 (이름 50%, 주소 35%, 키워드 15%)
  const weightedScore = (nameScore * 0.5) + (addressScore * 0.35) + (keywordBonus * 0.15);

  if (nameScore === 100 && addressScore === 100) {
    method = 'exact';
    details.push('기관명과 주소가 완전히 일치합니다');
  } else if (nameScore >= 90 && addressScore >= 80) {
    method = 'partial';
    details.push('기관명이 거의 일치하고 주소가 유사합니다');
  } else if (keywordBonus > 10) {
    method = 'keyword';
    details.push(`키워드 매칭: ${targetKeywords.type}`);
    if (targetKeywords.keywords.length > 0) {
      details.push(`핵심 키워드: ${targetKeywords.keywords.join(', ')}`);
    }
  } else if (nameScore >= 80 || addressScore >= 90) {
    method = 'partial';
    if (nameScore >= 80) details.push('기관명이 유사합니다');
    if (addressScore >= 90) details.push('주소가 거의 일치합니다');
  } else {
    details.push(`기관명 유사도: ${nameScore.toFixed(0)}%`);
    details.push(`주소 유사도: ${addressScore.toFixed(0)}%`);
    if (keywordBonus > 0) {
      details.push(`키워드 보너스: +${keywordBonus.toFixed(0)}점`);
    }
  }

  return {
    confidence: Math.round(weightedScore),
    matchingReason: {
      nameScore: Math.round(nameScore),
      addressScore: Math.round(addressScore),
      keywordBonus: Math.round(keywordBonus),
      method,
      details
    }
  };
}

// 복수 관리번호 그룹화
export function groupManagementNumbers(
  aedData: Array<{
    management_number: string;
    institution_name: string;
    address: string;
    equipment_serial: string[];
  }>
): Map<string, Array<{ management_number: string; equipment_serials: string[] }>> {
  const groups = new Map<string, Array<{ management_number: string; equipment_serials: string[] }>>();

  for (const aed of aedData) {
    const key = normalizeString(aed.institution_name) + '|' + normalizeString(aed.address);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)?.push({
      management_number: aed.management_number,
      equipment_serials: aed.equipment_serial
    });
  }

  return groups;
}

// 배치 매칭 수행
export async function performBatchMatching(
  targetList: Array<{
    target_key: string;
    institution_name: string;
    sido: string;
    gugun: string;
  }>,
  aedData: Array<{
    management_number: string;
    institution_name: string;
    sido: string;
    sigungu: string;
    address: string;
    equipment_serial: string[];
  }>
): Promise<Map<string, {
  target_key: string;
  matches: Array<{
    management_number: string;
    confidence: number;
    matchingReason: any;
    equipment_count: number;
  }>;
}>> {
  const results = new Map();

  for (const target of targetList) {
    const targetAddress = `${target.sido} ${target.gugun}`;
    const matches = [];

    // 같은 지역의 AED만 필터링
    const localAedData = aedData.filter(aed =>
      aed.sido === target.sido && aed.sigungu === target.gugun
    );

    for (const aed of localAedData) {
      const result = calculateMatchingScore(
        target.institution_name || '',
        targetAddress,
        aed.institution_name || '',
        aed.address || ''
      );

      if (result.confidence >= 50) { // 50% 이상만 후보로 포함
        matches.push({
          management_number: aed.management_number,
          confidence: result.confidence,
          matchingReason: result.matchingReason,
          equipment_count: aed.equipment_serial.length
        });
      }
    }

    // 신뢰도 순으로 정렬
    matches.sort((a, b) => b.confidence - a.confidence);

    if (matches.length > 0) {
      results.set(target.target_key, {
        target_key: target.target_key,
        matches: matches.slice(0, 10) // 상위 10개만 저장
      });
    }
  }

  return results;
}