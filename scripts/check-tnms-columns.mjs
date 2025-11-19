import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkColumns() {
  try {
    // 테이블 컬럼 확인
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'aedpics'
        AND table_name = 'tnms_matching_results'
      ORDER BY ordinal_position
    `;

    console.log('=== tnms_matching_results 테이블 컬럼 ===');
    columns.forEach(col => {
      console.log(`${col.column_name}: ${col.data_type}`);
    });

    // 샘플 데이터 확인
    console.log('\n=== 샘플 데이터 (1개) ===');
    const sample = await prisma.$queryRaw`
      SELECT * FROM aedpics.tnms_matching_results
      LIMIT 1
    `;
    console.log(sample[0]);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();