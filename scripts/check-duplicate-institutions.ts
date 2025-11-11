import { prisma } from '../lib/prisma';

async function checkDuplicateInstitutions() {
  try {
    // 대구 남구보건소 관련 모든 레코드 조회
    const namguRecords = await prisma.target_list_2024.findMany({
      where: {
        sido: '대구',
        institution_name: {
          contains: '남구보건소'
        }
      },
      orderBy: [
        { institution_name: 'asc' },
        { division: 'asc' }
      ]
    });

    console.log('=== 대구 남구보건소 관련 의무설치기관 ===\n');
    console.log(`총 ${namguRecords.length}개 발견\n`);

    namguRecords.forEach((record, idx) => {
      console.log(`${idx + 1}. 기관명: ${record.institution_name}`);
      console.log(`   Target Key: ${record.target_key}`);
      console.log(`   시도: ${record.sido}`);
      console.log(`   구군: ${record.gugun}`);
      console.log(`   Division: ${record.division}`);
      console.log(`   Sub Division: ${record.sub_division}`);
      console.log('');
    });

    // 동일 기관명이 여러 개인 경우 찾기
    console.log('\n=== 중복 기관명 분석 ===\n');

    const institutionCounts = namguRecords.reduce((acc, record) => {
      const name = record.institution_name;
      if (!acc[name]) {
        acc[name] = [];
      }
      acc[name].push(record);
      return acc;
    }, {} as Record<string, typeof namguRecords>);

    Object.entries(institutionCounts).forEach(([name, records]) => {
      if (records.length > 1) {
        console.log(`기관명: "${name}"`);
        console.log(`중복 개수: ${records.length}개`);
        records.forEach((r, idx) => {
          console.log(`  ${idx + 1}. Division: ${r.division}, Sub Division: ${r.sub_division}, Target Key: ${r.target_key}`);
        });
        console.log('');
      }
    });

    // UI에 표시되는 형식 확인
    console.log('\n=== UI에 표시되는 형식 ===\n');
    namguRecords.forEach((record, idx) => {
      const displayName = `${record.institution_name} (${record.division})`;
      console.log(`${idx + 1}. ${displayName}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateInstitutions();
