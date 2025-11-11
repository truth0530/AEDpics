import { prisma } from '../lib/prisma';

async function findVehicleNumberInData() {
  try {
    // 구급차 관련 레코드에서 패턴 확인
    const samples: any = await prisma.$queryRaw`
      SELECT
        target_key,
        institution_name,
        target_keygroup,
        management_number,
        division,
        sub_division
      FROM aedpics.target_list_2024
      WHERE sub_division LIKE '%구급차%'
      LIMIT 20
    `;

    console.log('=== 구급차 레코드 샘플 (차량번호 패턴 찾기) ===\n');
    samples.forEach((record: any, idx: number) => {
      console.log(`${idx + 1}.`);
      console.log(`   target_key: ${record.target_key}`);
      console.log(`   institution_name: ${record.institution_name}`);
      console.log(`   target_keygroup: ${record.target_keygroup}`);
      console.log(`   management_number: ${record.management_number || 'null'}`);
      console.log('');
    });

    // CSV 파일이 있는지 확인
    console.log('\n=== 원본 CSV 파일 확인 필요 ===');
    console.log('다음 경로에서 원본 CSV 파일을 확인해주세요:');
    console.log('- data/ 디렉토리');
    console.log('- docs/ 디렉토리');
    console.log('- 또는 import 스크립트가 있는 위치');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findVehicleNumberInData();
