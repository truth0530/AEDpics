import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== equipment_serial 중복 검사 ===\n');

  // 1. 전체 장비 수
  const totalDevices = await prisma.aed_data.count();
  console.log(`전체 AED 장비: ${totalDevices.toLocaleString()}대`);

  // 2. equipment_serial 중복 검사
  const duplicates = await prisma.$queryRaw<Array<{
    equipment_serial: string;
    count: bigint;
  }>>`
    SELECT
      equipment_serial,
      COUNT(*)::bigint as count
    FROM aedpics.aed_data
    GROUP BY equipment_serial
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `;

  console.log(`\n중복된 equipment_serial: ${duplicates.length}개`);

  if (duplicates.length > 0) {
    console.log('\n=== 중복 장비연번 TOP 10 ===');
    for (const dup of duplicates) {
      console.log(`${dup.equipment_serial}: ${dup.count}건`);

      // 중복 레코드 상세 정보
      const details = await prisma.aed_data.findMany({
        where: {
          equipment_serial: dup.equipment_serial
        },
        select: {
          id: true,
          equipment_serial: true,
          serial_number: true,
          installation_institution: true,
          sido: true,
          gugun: true
        },
        take: 3
      });

      details.forEach((detail, idx) => {
        console.log(`  ${idx + 1}. ID: ${detail.id}, 제조번호: ${detail.serial_number}, 위치: ${detail.sido} ${detail.gugun}, 기관: ${detail.installation_institution}`);
      });
      console.log('');
    }
  } else {
    console.log('\n✅ equipment_serial은 모두 고유합니다 (중복 없음)');
  }

  // 3. serial_number (제조번호) 중복 검사
  console.log('\n=== serial_number (제조번호) 중복 검사 ===');
  const serialDuplicates = await prisma.$queryRaw<Array<{
    serial_number: string;
    count: bigint;
  }>>`
    SELECT
      serial_number,
      COUNT(*)::bigint as count
    FROM aedpics.aed_data
    WHERE serial_number IS NOT NULL AND serial_number != ''
    GROUP BY serial_number
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `;

  console.log(`중복된 serial_number (제조번호): ${serialDuplicates.length}개`);

  if (serialDuplicates.length > 0) {
    console.log('\n제조번호 중복 사례:');
    for (const dup of serialDuplicates) {
      console.log(`  ${dup.serial_number}: ${dup.count}건`);
    }
  }

  // 4. 결론
  console.log('\n=== 결론 ===');
  if (duplicates.length > 0) {
    console.log('⚠️ equipment_serial에 중복이 존재합니다.');
    console.log('⚠️ JOIN 조건을 다시 검토해야 합니다.');
  } else {
    console.log('✅ equipment_serial은 고유 식별자로 사용 가능합니다.');
    console.log('✅ 현재 JOIN 조건이 올바릅니다.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
