import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  try {
    // tnms_matching_results 테이블 확인
    const count = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM aedpics.tnms_matching_results
    `;

    console.log('=== TNMS Matching Results ===');
    console.log('총 레코드 수:', count[0].count);

    // 샘플 데이터 확인
    const sample = await prisma.$queryRaw`
      SELECT * FROM aedpics.tnms_matching_results
      ORDER BY confidence DESC
      LIMIT 5
    `;

    console.log('\n상위 5개 매칭 결과:');
    sample.forEach((row, i) => {
      console.log(`\n${i + 1}. Target: ${row.target_key}`);
      console.log(`   Equipment: ${row.equipment_serial}`);
      console.log(`   Confidence: ${row.confidence}%`);
      console.log(`   Match Type: ${row.match_type}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();