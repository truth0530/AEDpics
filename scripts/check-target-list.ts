import { prisma } from '../lib/prisma';

async function checkTargetList() {
  try {
    // 1. 총 개수 확인
    const totalCount = await prisma.target_list_2024.count();
    console.log(`\n총 2024년 의무설치기관 수: ${totalCount}개\n`);

    // 2. 군위군 관련 기관 확인
    const gunwiInstitutions = await prisma.target_list_2024.findMany({
      where: {
        institution_name: {
          contains: '군위군'
        }
      },
      select: {
        target_key: true,
        institution_name: true,
        sido: true,
        gugun: true,
        division: true,
        created_at: true
      },
      orderBy: [
        { institution_name: 'asc' },
        { created_at: 'asc' }
      ]
    });

    console.log(`군위군 관련 기관 수: ${gunwiInstitutions.length}개\n`);

    if (gunwiInstitutions.length > 0) {
      console.log('상세 정보:');
      gunwiInstitutions.forEach((inst, index) => {
        console.log(`\n${index + 1}. ${inst.institution_name}`);
        console.log(`   - target_key: ${inst.target_key}`);
        console.log(`   - 시도: ${inst.sido}`);
        console.log(`   - 구군: ${inst.gugun}`);
        console.log(`   - 구분: ${inst.division}`);
        console.log(`   - 생성일: ${inst.created_at}`);
      });
    }

    // 3. 중복 체크 (같은 institution_name이 2개 이상인 경우)
    const duplicates = await prisma.$queryRaw<Array<{ institution_name: string; count: bigint }>>`
      SELECT institution_name, COUNT(*) as count
      FROM aedpics.target_list_2024
      GROUP BY institution_name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `;

    if (duplicates.length > 0) {
      console.log(`\n\n중복된 기관명 (상위 10개):`);
      duplicates.forEach((dup, index) => {
        console.log(`${index + 1}. ${dup.institution_name}: ${dup.count}개`);
      });
    } else {
      console.log('\n\n중복된 기관명이 없습니다.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTargetList();
