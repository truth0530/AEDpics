import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findExample() {
  console.log('=== 구급차와 일반 기관이 함께 있는 실제 사례 찾기 ===\n');

  // 1. 구급차가 포함된 기관명 패턴으로 검색
  const ambulanceInstitutions = await prisma.target_list_2025.findMany({
    where: {
      OR: [
        { sub_division: { contains: '구급차' } },
        { division: { contains: '119' } },
        { division: { contains: '구급차' } }
      ]
    },
    select: {
      target_key: true,
      institution_name: true,
      division: true,
      sub_division: true,
      sido: true,
      gugun: true
    },
    take: 20
  });

  console.log(`구급차 기관 ${ambulanceInstitutions.length}개 발견\n`);

  // 2. 각 구급차 기관에 대해 유사한 일반 기관 찾기
  for (const ambulance of ambulanceInstitutions) {
    // 기관명에서 "구급차" 제거한 버전으로 검색
    const baseName = ambulance.institution_name.replace(/구급차/g, '').trim();

    const similarInstitutions = await prisma.target_list_2025.findMany({
      where: {
        institution_name: { contains: baseName },
        sido: ambulance.sido,
        gugun: ambulance.gugun,
        NOT: {
          OR: [
            { sub_division: { contains: '구급차' } },
            { division: { contains: '119' } },
            { division: { contains: '구급차' } }
          ]
        }
      },
      select: {
        target_key: true,
        institution_name: true,
        division: true,
        sub_division: true,
        sido: true,
        gugun: true
      },
      take: 3
    });

    if (similarInstitutions.length > 0) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ 발견된 사례:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('[구급차 기관]');
      console.log(`  기관명: ${ambulance.institution_name}`);
      console.log(`  주소: ${ambulance.sido} ${ambulance.gugun}`);
      console.log(`  분류: ${ambulance.division}`);
      console.log(`  세부분류: ${ambulance.sub_division || '(없음)'}`);
      console.log(`  target_key: ${ambulance.target_key}\n`);

      console.log('[유사한 일반 기관들]');
      similarInstitutions.forEach((inst, idx) => {
        console.log(`  ${idx + 1}. ${inst.institution_name}`);
        console.log(`     주소: ${inst.sido} ${inst.gugun}`);
        console.log(`     분류: ${inst.division}`);
        console.log(`     세부분류: ${inst.sub_division || '(없음)'}`);
        console.log(`     target_key: ${inst.target_key}\n`);
      });

      // 첫 번째 사례만 출력
      break;
    }
  }

  await prisma.$disconnect();
}

findExample().catch(console.error);
