import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testComplianceStatsAPIs() {
  console.log('=== 통계 API 데이터 검증 ===\n');

  // 1. target_list_2025 총 개수
  const totalTargets = await prisma.target_list_2025.count();
  console.log(`1. target_list_2025 총 기관 수: ${totalTargets}`);

  // 2. target_list_devices 매칭 데이터
  const totalMatches = await prisma.target_list_devices.count({
    where: { target_list_year: 2025 }
  });
  console.log(`2. target_list_devices 총 매칭 수 (2025): ${totalMatches}`);

  // 3. 매칭된 고유 기관 수
  const matchedInstitutions = await prisma.target_list_devices.findMany({
    where: { target_list_year: 2025 },
    select: { target_institution_id: true },
    distinct: ['target_institution_id']
  });
  console.log(`3. 매칭된 고유 기관 수: ${matchedInstitutions.length}`);

  // 4. 샘플 매칭 데이터 (첫 3개)
  const sampleMatches = await prisma.target_list_devices.findMany({
    where: { target_list_year: 2025 },
    take: 3,
    include: {
      target_list_2025: {
        select: {
          institution_name: true,
          sido: true,
          gugun: true
        }
      }
    }
  });

  console.log('\n4. 샘플 매칭 데이터:');
  sampleMatches.forEach((m, idx) => {
    console.log(`   [${idx + 1}] ${m.target_list_2025?.institution_name || 'N/A'}`);
    console.log(`       - 지역: ${m.target_list_2025?.sido} ${m.target_list_2025?.gugun}`);
    console.log(`       - 장비연번: ${m.equipment_serial}`);
    console.log(`       - target_key: ${m.target_institution_id}`);
  });

  // 5. 점검 데이터 확인
  const totalInspections = await prisma.inspections.count();
  console.log(`\n5. 전체 점검 기록 수: ${totalInspections}`);

  // 6. 매칭된 장비의 점검 기록
  const matchedSerials = matchedInstitutions.length > 0
    ? await prisma.target_list_devices.findMany({
        where: { target_list_year: 2025 },
        select: { equipment_serial: true },
        distinct: ['equipment_serial']
      })
    : [];

  const inspectedMatches = matchedSerials.length > 0
    ? await prisma.inspections.count({
        where: {
          equipment_serial: {
            in: matchedSerials.map(m => m.equipment_serial)
          }
        }
      })
    : 0;

  console.log(`6. 매칭된 장비의 점검 기록 수: ${inspectedMatches}`);

  // 7. 지역별 매칭 통계
  const matchesBySido = await prisma.$queryRaw`
    SELECT
      t.sido,
      COUNT(DISTINCT t.target_key) as total_institutions,
      COUNT(DISTINCT d.target_institution_id) as matched_institutions
    FROM target_list_2025 t
    LEFT JOIN target_list_devices d
      ON d.target_institution_id = t.target_key
      AND d.target_list_year = 2025
    GROUP BY t.sido
    ORDER BY matched_institutions DESC
    LIMIT 5
  `;

  console.log('\n7. 지역별 매칭 통계 (상위 5개):');
  matchesBySido.forEach((row, idx) => {
    console.log(`   [${idx + 1}] ${row.sido}: 전체 ${row.total_institutions}개 중 ${row.matched_institutions}개 매칭`);
  });

  // 8. API 응답 시뮬레이션 - matching-status
  console.log('\n8. API 응답 시뮬레이션:');

  const matchingStatusQuery = await prisma.$queryRaw`
    SELECT
      t.target_key,
      t.institution_name,
      t.sido,
      t.gugun,
      COUNT(DISTINCT d.equipment_serial) as matched_equipment_count
    FROM target_list_2025 t
    LEFT JOIN target_list_devices d
      ON d.target_institution_id = t.target_key
      AND d.target_list_year = 2025
    GROUP BY t.target_key, t.institution_name, t.sido, t.gugun
    HAVING COUNT(DISTINCT d.equipment_serial) > 0
    ORDER BY matched_equipment_count DESC
    LIMIT 3
  `;

  console.log('   matching-status 샘플 응답:');
  matchingStatusQuery.forEach((row, idx) => {
    console.log(`   [${idx + 1}] ${row.institution_name} (${row.sido} ${row.gugun}): ${row.matched_equipment_count}개 장비`);
  });

  console.log('\n=== 검증 완료 ===');
}

testComplianceStatsAPIs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
