import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAmbulanceData() {
  console.log('\n=== 구급차 관련 데이터 분석 ===\n');

  // 1. target_list_2025에서 sub_division에 "119"와 "구급차" 포함
  console.log('1. target_list_2025 - sub_division에 "119"와 "구급차" 포함:');
  const target119 = await prisma.$queryRaw`
    SELECT sub_division, COUNT(*) as count
    FROM target_list_2025
    WHERE sub_division LIKE '%119%' AND sub_division LIKE '%구급차%'
    GROUP BY sub_division
    ORDER BY count DESC
    LIMIT 10
  `;
  console.log(target119);

  // 2. aed_data에서 category_2에 "의료기관에서 운용 중인 구급차" 포함
  console.log('\n2. aed_data - category_2에 "의료기관에서 운용 중인 구급차":');
  const aedMedicalAmbulance = await prisma.$queryRaw`
    SELECT category_2, COUNT(*) as count
    FROM aed_data
    WHERE category_2 LIKE '%의료기관%구급차%'
    GROUP BY category_2
    ORDER BY count DESC
    LIMIT 10
  `;
  console.log(aedMedicalAmbulance);

  // 3. aed_data에서 category_2에 "119구급대" 포함
  console.log('\n3. aed_data - category_2에 "119구급대":');
  const aed119Rescue = await prisma.$queryRaw`
    SELECT category_2, COUNT(*) as count
    FROM aed_data
    WHERE category_2 LIKE '%119구급대%'
    GROUP BY category_2
    ORDER BY count DESC
    LIMIT 10
  `;
  console.log(aed119Rescue);

  // 4. aed_data - 구비의무기관 외 > 구급차
  console.log('\n4. aed_data - category_1="구비의무기관 외", category_2="구급차":');
  const aedNonMandatoryAmbulance = await prisma.$queryRaw`
    SELECT category_2, COUNT(*) as count
    FROM aed_data
    WHERE category_1 = '구비의무기관 외' AND category_2 LIKE '%구급차%'
    GROUP BY category_2
    ORDER BY count DESC
  `;
  console.log(aedNonMandatoryAmbulance);

  // 5. 모든 구급차 관련 category_2 패턴
  console.log('\n5. 모든 구급차 관련 category_2 패턴:');
  const allAmbulancePatterns = await prisma.$queryRaw`
    SELECT DISTINCT category_2, COUNT(*) as count
    FROM aed_data
    WHERE category_2 LIKE '%구급차%'
    GROUP BY category_2
    ORDER BY count DESC
  `;
  console.log(allAmbulancePatterns);

  await prisma.$disconnect();
}

checkAmbulanceData().catch(console.error);
