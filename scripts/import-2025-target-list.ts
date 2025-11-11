import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface Target2025Record {
  no: string;
  sido: string;
  gugun: string;
  division: string;
  sub_division: string;
  institution_name: string;
  unique_key: string;
  address: string;
  contact: string;
  target_key: string;
  target_keygroup: string;
  data_year: string;
}

async function importTargetList2025() {
  const csvFilePath = path.join(process.cwd(), 'scripts/data/target_list_2025_normalized.csv');

  console.log('='.repeat(80));
  console.log('2025년 의무설치기관 데이터 Import 시작');
  console.log('='.repeat(80));
  console.log(`\nCSV 파일: ${csvFilePath}`);

  // 1. CSV 파일 읽기
  console.log('\n[1단계] CSV 파일 읽기...');
  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Target2025Record[];

  console.log(`✓ 총 ${records.length.toLocaleString()}개 레코드 발견`);

  // 2. 데이터 변환 및 검증
  console.log('\n[2단계] 데이터 변환 및 검증...');
  const validRecords = records.filter(record => {
    if (!record.target_key || record.target_key.trim() === '') {
      console.log(`⚠️  target_key 없음: ${record.institution_name}`);
      return false;
    }
    return true;
  });

  console.log(`✓ 유효한 레코드: ${validRecords.length.toLocaleString()}개`);

  // 3. 기존 데이터 확인
  console.log('\n[3단계] 기존 데이터 확인...');
  const existingCount = await prisma.target_list_2025.count();
  console.log(`✓ 기존 레코드: ${existingCount.toLocaleString()}개`);

  if (existingCount > 0) {
    console.log('\n⚠️  기존 데이터가 있습니다. 삭제하고 진행할까요?');
    console.log('   (Ctrl+C를 눌러 취소하거나 10초 후 자동 진행)');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n기존 데이터 삭제 중...');
    const deleted = await prisma.target_list_2025.deleteMany({});
    console.log(`✓ ${deleted.count.toLocaleString()}개 레코드 삭제됨`);
  }

  // 4. 데이터 Import (Batch Insert)
  console.log('\n[4단계] 데이터 Import...');
  const batchSize = 500;
  let importedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < validRecords.length; i += batchSize) {
    const batch = validRecords.slice(i, i + batchSize);

    try {
      const data = batch.map(record => ({
        target_key: record.target_key,
        no: record.no ? parseInt(record.no) : null,
        sido: record.sido || null,
        gugun: record.gugun || null,
        division: record.division || null,
        sub_division: record.sub_division || null,
        institution_name: record.institution_name || null,
        unique_key: record.unique_key || null,
        address: record.address || null,
        contact: record.contact || null,
        target_keygroup: record.target_keygroup || null,
        data_year: 2025,
        imported_at: new Date(),
      }));

      await prisma.target_list_2025.createMany({
        data,
        skipDuplicates: true,
      });

      importedCount += batch.length;
      const progress = ((i + batch.length) / validRecords.length * 100).toFixed(1);
      process.stdout.write(`\r✓ Progress: ${progress}% (${importedCount.toLocaleString()}/${validRecords.length.toLocaleString()})`);
    } catch (error) {
      errorCount += batch.length;
      console.error(`\n❌ Batch ${i}-${i + batch.length} 실패:`, error);
    }
  }

  console.log('\n');

  // 5. Import 결과 확인
  console.log('\n[5단계] Import 결과 확인...');
  const finalCount = await prisma.target_list_2025.count();
  console.log(`✓ 최종 레코드 수: ${finalCount.toLocaleString()}개`);
  console.log(`✓ 성공: ${importedCount.toLocaleString()}개`);

  if (errorCount > 0) {
    console.log(`⚠️  실패: ${errorCount.toLocaleString()}개`);
  }

  // 6. 시도별 통계
  console.log('\n[6단계] 시도별 통계:');
  const sidoStats = await prisma.$queryRaw<Array<{ sido: string; count: bigint }>>`
    SELECT sido, COUNT(*) as count
    FROM aedpics.target_list_2025
    GROUP BY sido
    ORDER BY count DESC
  `;

  sidoStats.forEach(stat => {
    console.log(`   ${stat.sido}: ${Number(stat.count).toLocaleString()}개`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ Import 완료!');
  console.log('='.repeat(80));
}

// 실행
importTargetList2025()
  .catch(error => {
    console.error('\n❌ Import 실패:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
