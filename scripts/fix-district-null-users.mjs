import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function fixDistrictNullUsers() {
  try {
    console.log('\n=== district null 사용자 보정 ===\n');

    // HIGH 신뢰도 3명 + 서자영(세종, MEDIUM)
    const corrections = [
      {
        id: 'afe37686-3007-4a03-9bf1-4e9f7b2cc314',
        name: '김민주',
        email: 'kimnju629@korea.kr',
        district: '동구',
        reason: '대구 동구 보건소',
      },
      {
        id: '0b474723-a722-418b-8293-81543bfd8b40',
        name: '서수진',
        email: 'windy062@korea.kr',
        district: '군위군',
        reason: '대구 군위군 보건소',
      },
      {
        id: '63c5bc3a-6872-4755-a812-74eb243211e6',
        name: '최혜진',
        email: 'iamchjin@korea.kr',
        district: '남구',
        reason: '대구 남구 보건소',
      },
      {
        id: '93830d04-d553-44e2-ab01-4c5f138ce32b',
        name: '서자영',
        email: 'seojayoung@korea.kr',
        district: '세종특별자치시',
        reason: '세종특별자치시 (시도=보건소 개념)',
      },
    ];

    console.log('보정 대상 4명:\n');
    corrections.forEach((c, idx) => {
      console.log(`${idx + 1}. ${c.name} (${c.email})`);
      console.log(`   district: NULL → "${c.district}"`);
      console.log(`   사유: ${c.reason}\n`);
    });

    console.log('보정 시작...\n');

    // Transaction으로 실행
    await prisma.$transaction(async (tx) => {
      for (const correction of corrections) {
        const result = await tx.user_profiles.update({
          where: { id: correction.id },
          data: { district: correction.district },
        });

        console.log(`✓ ${correction.name} (${correction.email})`);
        console.log(`  district: ${result.district}`);
      }
    });

    console.log('\n=== 보정 완료 ===\n');

    // 확인
    console.log('보정 후 확인:\n');
    for (const correction of corrections) {
      const user = await prisma.user_profiles.findUnique({
        where: { id: correction.id },
        select: {
          full_name: true,
          email: true,
          region_code: true,
          district: true,
        }
      });

      console.log(`${user.full_name} (${user.email})`);
      console.log(`  → ${user.region_code} / ${user.district}\n`);
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixDistrictNullUsers();
