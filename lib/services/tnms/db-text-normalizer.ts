import { prisma } from '@/lib/prisma';

/**
 * 데이터베이스 TNMS 함수를 직접 호출하는 정규화 서비스
 */
export class DBTextNormalizer {
  /**
   * 데이터베이스 TNMS 정규화 함수 호출
   */
  async normalize(text: string): Promise<string> {
    try {
      const result = await prisma.$queryRaw<Array<{normalized: string}>>`
        SELECT aedpics.tnms_normalize(${text}) as normalized
      `;
      return result[0]?.normalized || text;
    } catch (error) {
      console.error('TNMS normalization error:', error);
      // 에러 시 원본 텍스트 반환
      return text;
    }
  }

  /**
   * 여러 텍스트를 한 번에 정규화
   */
  async normalizeMany(texts: string[]): Promise<string[]> {
    if (texts.length === 0) return [];

    try {
      // PostgreSQL의 unnest를 사용하여 배치 처리
      const result = await prisma.$queryRaw<Array<{normalized: string}>>`
        SELECT aedpics.tnms_normalize(text) as normalized
        FROM unnest(ARRAY[${texts.join(',')}]::text[]) AS text
      `;
      return result.map(r => r.normalized);
    } catch (error) {
      console.error('TNMS batch normalization error:', error);
      // 에러 시 원본 텍스트들 반환
      return texts;
    }
  }
}

export const dbTextNormalizer = new DBTextNormalizer();