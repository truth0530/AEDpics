import { prisma } from '../lib/prisma';

async function checkGunwiDetail() {
  try {
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
        sub_division: true,
        no: true,
        target_keygroup: true,
        management_number: true,
        created_at: true
      },
      orderBy: [
        { institution_name: 'asc' },
        { created_at: 'asc' }
      ]
    });

    console.log(`\n군위군 관련 기관: ${gunwiInstitutions.length}개\n`);

    gunwiInstitutions.forEach((inst, index) => {
      console.log(`\n${index + 1}. ${inst.institution_name}`);
      console.log(`   target_key: ${inst.target_key}`);
      console.log(`   시도: ${inst.sido}`);
      console.log(`   구군: ${inst.gugun}`);
      console.log(`   구분: ${inst.division || '(없음)'}`);
      console.log(`   세부구분: ${inst.sub_division || '(없음)'}`);
      console.log(`   번호: ${inst.no || '(없음)'}`);
      console.log(`   그룹: ${inst.target_keygroup || '(없음)'}`);
      console.log(`   관리번호: ${inst.management_number || '(없음)'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGunwiDetail();
