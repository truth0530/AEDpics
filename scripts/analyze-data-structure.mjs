import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('=== 데이터 구조 분석 시작 ===\n');

try {
  // 1. aed_data.sido 칼럼 분석
  console.log('1. aed_data.sido 칼럼 값 분포:');
  const aedSidoDistinct = await prisma.$queryRaw`
    SELECT DISTINCT sido, COUNT(*) as count
    FROM aedpics.aed_data
    WHERE sido IS NOT NULL
    GROUP BY sido
    ORDER BY count DESC
    LIMIT 20;
  `;
  console.table(aedSidoDistinct);

  // 2. target_list_2025.sido 칼럼 분석
  console.log('\n2. target_list_2025.sido 칼럼 값 분포:');
  const targetSidoDistinct = await prisma.$queryRaw`
    SELECT DISTINCT sido, COUNT(*) as count
    FROM aedpics.target_list_2025
    WHERE sido IS NOT NULL
    GROUP BY sido
    ORDER BY count DESC
    LIMIT 20;
  `;
  console.table(targetSidoDistinct);

  // 3. aed_data.jurisdiction_health_center 패턴 분석
  console.log('\n3. aed_data.jurisdiction_health_center 샘플 (20개):');
  const jurisdictionSamples = await prisma.$queryRaw`
    SELECT DISTINCT jurisdiction_health_center, sido
    FROM aedpics.aed_data
    WHERE jurisdiction_health_center IS NOT NULL
    LIMIT 20;
  `;
  console.table(jurisdictionSamples);

  // 4. aed_data 주소 칼럼 분석
  console.log('\n4. aed_data 주소 칼럼 샘플 (10개):');
  const addressSamples = await prisma.$queryRaw`
    SELECT sido, gugun, installation_address
    FROM aedpics.aed_data
    WHERE installation_address IS NOT NULL
    LIMIT 10;
  `;
  console.table(addressSamples);

  // 5. target_list_2025 주소 칼럼 분석
  console.log('\n5. target_list_2025 주소 칼럼 샘플 (10개):');
  const targetAddressSamples = await prisma.$queryRaw`
    SELECT sido, gugun, address
    FROM aedpics.target_list_2025
    WHERE address IS NOT NULL
    LIMIT 10;
  `;
  console.table(targetAddressSamples);

  // 6. organizations 기관명 패턴 분석
  console.log('\n6. organizations 기관명 샘플 (보건소만):');
  const orgSamples = await prisma.$queryRaw`
    SELECT name, region_code, city_code
    FROM aedpics.organizations
    WHERE name LIKE '%보건소%'
    LIMIT 20;
  `;
  console.table(orgSamples);

  // 7. sido 값 비교 (aed_data vs target_list_2025)
  console.log('\n7. sido 값 형식 비교:');
  console.log('aed_data.sido 예시:', aedSidoDistinct[0]?.sido);
  console.log('target_list_2025.sido 예시:', targetSidoDistinct[0]?.sido);

  console.log('\n=== 분석 완료 ===');

} catch (error) {
  console.error('Error:', error);
} finally {
  await prisma.$disconnect();
}
