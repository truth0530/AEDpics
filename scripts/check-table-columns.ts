import { prisma } from '../lib/prisma';

async function checkTableColumns() {
  try {
    // PostgreSQL에서 테이블의 모든 컬럼 정보 조회
    const columns: any = await prisma.$queryRaw`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'aedpics'
        AND table_name = 'target_list_2024'
      ORDER BY ordinal_position
    `;

    console.log('=== target_list_2024 테이블의 모든 컬럼 ===\n');
    columns.forEach((col: any, idx: number) => {
      console.log(`${idx + 1}. ${col.column_name}`);
      console.log(`   타입: ${col.data_type}`);
      if (col.character_maximum_length) {
        console.log(`   길이: ${col.character_maximum_length}`);
      }
      console.log(`   NULL 허용: ${col.is_nullable}`);
      console.log('');
    });

    console.log(`\n총 ${columns.length}개의 컬럼\n`);

    // 차량번호가 있을 만한 필드명 검색
    const vehicleRelated = columns.filter((col: any) =>
      col.column_name.includes('vehicle') ||
      col.column_name.includes('car') ||
      col.column_name.includes('number') ||
      col.column_name.includes('번호') ||
      col.column_name.includes('차량')
    );

    if (vehicleRelated.length > 0) {
      console.log('=== 차량/번호 관련 컬럼 ===\n');
      vehicleRelated.forEach((col: any) => {
        console.log(`- ${col.column_name} (${col.data_type})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTableColumns();
