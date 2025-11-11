import { prisma } from '../lib/prisma';

async function findAmbulanceVehicleNumber() {
  try {
    // 구급차 관련 레코드 조회 (division에 "구급차" 포함)
    const ambulanceRecords = await prisma.target_list_2024.findMany({
      where: {
        OR: [
          { division: { contains: '구급차' } },
          { sub_division: { contains: '구급차' } },
          { institution_name: { contains: '구급차' } }
        ]
      },
      take: 10
    });

    console.log('=== 구급차 관련 의무설치기관 레코드 ===\n');
    console.log(`총 ${ambulanceRecords.length}개 발견\n`);

    ambulanceRecords.forEach((record, idx) => {
      console.log(`${idx + 1}. 레코드 상세:`);
      console.log(`   target_key: ${record.target_key}`);
      console.log(`   no: ${record.no}`);
      console.log(`   sido: ${record.sido}`);
      console.log(`   gugun: ${record.gugun}`);
      console.log(`   division: ${record.division}`);
      console.log(`   sub_division: ${record.sub_division}`);
      console.log(`   institution_name: ${record.institution_name}`);
      console.log(`   target_keygroup: ${record.target_keygroup}`);
      console.log(`   management_number: ${record.management_number}`);
      console.log('');
    });

    // 전체 필드 목록 확인
    if (ambulanceRecords.length > 0) {
      console.log('=== 첫 번째 레코드의 모든 필드 ===\n');
      console.log(JSON.stringify(ambulanceRecords[0], null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findAmbulanceVehicleNumber();
