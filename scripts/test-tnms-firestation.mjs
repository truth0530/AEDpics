import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    // 스키마 확인
    const rules = await prisma.$queryRaw`
      SELECT * FROM aedpics.tnms_normalization_rules 
      WHERE pattern LIKE '%중부소방%' 
         OR pattern LIKE '%소방서%'
         OR replacement LIKE '%소방서%'
      ORDER BY priority ASC
      LIMIT 10
    `;
    
    console.log('=== 소방서 관련 TNMS 규칙 ===');
    console.log(rules);
    
    // TNMS 정규화 함수 테스트
    const testCases = [
      '대구중부소방서',
      '중부소방서(본대구급대)',
      '중부소방서'
    ];
    
    console.log('\n=== TNMS 정규화 테스트 ===');
    for (const text of testCases) {
      const normalized = await prisma.$queryRaw`
        SELECT aedpics.tnms_normalize(${text}) as normalized
      `;
      console.log(`"${text}" → "${normalized[0].normalized}"`);
    }
    
    // Levenshtein 거리 테스트
    const result1 = await prisma.$queryRaw`
      SELECT levenshtein(
        aedpics.tnms_normalize('대구중부소방서'),
        aedpics.tnms_normalize('중부소방서(본대구급대)')
      ) as distance
    `;
    
    const result2 = await prisma.$queryRaw`
      SELECT levenshtein(
        aedpics.tnms_normalize('대구중부소방서'),
        aedpics.tnms_normalize('티웨이항공')
      ) as distance
    `;
    
    console.log('\n=== Levenshtein 거리 ===');
    console.log('대구중부소방서 ↔ 중부소방서(본대구급대):', result1[0].distance);
    console.log('대구중부소방서 ↔ 티웨이항공:', result2[0].distance);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
