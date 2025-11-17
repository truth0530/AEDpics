import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('=== 대구 지역 AED 데이터 확인 ===\n');

try {
  // 1. 약칭 "대구"로 검색
  const countShort = await prisma.aed_data.count({
    where: { sido: '대구' }
  });
  console.log('1. 약칭 "대구"로 검색:', countShort, '대');

  // 2. 정식명칭 "대구광역시"로 검색
  const countLong = await prisma.aed_data.count({
    where: { sido: '대구광역시' }
  });
  console.log('2. 정식명칭 "대구광역시"로 검색:', countLong, '대');

  // 3. 부분 일치로 검색
  const countLike = await prisma.aed_data.count({
    where: { sido: { contains: '대구' } }
  });
  console.log('3. 부분 일치 "대구" 포함:', countLike, '대');

  // 4. 전체 시도 목록 및 개수
  console.log('\n4. 전체 시도별 AED 개수:');
  const sidoGroups = await prisma.$queryRaw`
    SELECT sido, COUNT(*)::int as count
    FROM aedpics.aed_data
    WHERE sido LIKE '%대구%'
    GROUP BY sido
    ORDER BY count DESC
  `;
  sidoGroups.forEach(g => {
    console.log(`   ${g.sido}: ${g.count}대`);
  });

  // 5. 샘플 데이터 확인
  console.log('\n5. 샘플 데이터 (5건):');
  const samples = await prisma.aed_data.findMany({
    where: { sido: { contains: '대구' } },
    take: 5,
    select: {
      management_number: true,
      sido: true,
      gugun: true,
      installation_institution: true
    }
  });
  samples.forEach((s, idx) => {
    console.log(`   ${idx + 1}. [${s.sido}] ${s.gugun} - ${s.installation_institution}`);
  });

} catch (error) {
  console.error('Error:', error.message);
} finally {
  await prisma.$disconnect();
}
