import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('=== aed_data.sido 정합 작업 시작 ===\n');

// 정식명칭 → 약칭 매핑
const FORMAL_TO_SHORT = {
  '서울특별시': '서울',
  '부산광역시': '부산',
  '대구광역시': '대구',
  '인천광역시': '인천',
  '광주광역시': '광주',
  '대전광역시': '대전',
  '울산광역시': '울산',
  '세종특별자치시': '세종',
  '경기도': '경기',
  '강원특별자치도': '강원',
  '강원도': '강원',
  '충청북도': '충북',
  '충청남도': '충남',
  '전북특별자치도': '전북',
  '전라북도': '전북',
  '전라남도': '전남',
  '경상북도': '경북',
  '경상남도': '경남',
  '제주특별자치도': '제주',
  '제주도': '제주'
};

try {
  // 1. 현재 정식명칭 사용 현황 확인
  console.log('1. 정식명칭 사용 현황:');
  const formalNames = Object.keys(FORMAL_TO_SHORT);
  for (const formalName of formalNames) {
    const count = await prisma.aed_data.count({
      where: { sido: formalName }
    });
    if (count > 0) {
      console.log(`   ${formalName}: ${count}개`);
    }
  }

  // 2. 백업 확인 메시지
  console.log('\n2. 백업 권장:');
  console.log('   이 작업은 aed_data.sido 칼럼을 영구적으로 변경합니다.');
  console.log('   계속하려면 5초 대기 중...\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // 3. UPDATE 실행
  console.log('3. UPDATE 실행 중...\n');
  let totalUpdated = 0;

  for (const [formalName, shortName] of Object.entries(FORMAL_TO_SHORT)) {
    const result = await prisma.aed_data.updateMany({
      where: { sido: formalName },
      data: { sido: shortName }
    });

    if (result.count > 0) {
      console.log(`   ✓ ${formalName} → ${shortName}: ${result.count}개 업데이트`);
      totalUpdated += result.count;
    }
  }

  console.log(`\n   총 ${totalUpdated}개 레코드 업데이트 완료`);

  // 4. 검증
  console.log('\n4. 검증 중...');
  let remainingFormal = 0;
  for (const formalName of formalNames) {
    const count = await prisma.aed_data.count({
      where: { sido: formalName }
    });
    remainingFormal += count;
  }

  if (remainingFormal === 0) {
    console.log('   ✅ 모든 정식명칭이 약칭으로 변환되었습니다!');
  } else {
    console.log(`   ⚠️  ${remainingFormal}개 정식명칭이 남아있습니다.`);
  }

  // 5. 최종 sido 분포 확인
  console.log('\n5. 최종 sido 분포 (상위 10개):');
  const finalDistribution = await prisma.$queryRaw`
    SELECT sido, COUNT(*) as count
    FROM aedpics.aed_data
    WHERE sido IS NOT NULL
    GROUP BY sido
    ORDER BY count DESC
    LIMIT 10;
  `;
  console.table(finalDistribution);

  console.log('\n=== 정합 작업 완료 ===');

} catch (error) {
  console.error('\n❌ Error:', error);
  throw error;
} finally {
  await prisma.$disconnect();
}
