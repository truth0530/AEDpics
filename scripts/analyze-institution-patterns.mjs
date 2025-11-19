#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeInstitutionPatterns() {
  console.log('=== 기관명 패턴 분석 시작 ===\n');

  // 1. target_list_2025 접미사 분석
  console.log('1. target_list_2025 접미사 분석');
  console.log('-------------------------------');

  const targetSuffixes = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN institution_name LIKE '%보건소' THEN '보건소'
        WHEN institution_name LIKE '%보건지소' THEN '보건지소'
        WHEN institution_name LIKE '%소방서' THEN '소방서'
        WHEN institution_name LIKE '%센터' THEN '센터'
        WHEN institution_name LIKE '%병원' THEN '병원'
        WHEN institution_name LIKE '%의원' THEN '의원'
        WHEN institution_name LIKE '%의료원' THEN '의료원'
        WHEN institution_name LIKE '%학교' THEN '학교'
        WHEN institution_name LIKE '%대학' THEN '대학'
        WHEN institution_name LIKE '%주민센터' THEN '주민센터'
        WHEN institution_name LIKE '%행정복지센터' THEN '행정복지센터'
        WHEN institution_name LIKE '%읍사무소' THEN '읍사무소'
        WHEN institution_name LIKE '%면사무소' THEN '면사무소'
        WHEN institution_name LIKE '%동사무소' THEN '동사무소'
        WHEN institution_name LIKE '%파출소' THEN '파출소'
        WHEN institution_name LIKE '%지구대' THEN '지구대'
        WHEN institution_name LIKE '%경찰서' THEN '경찰서'
        WHEN institution_name LIKE '%공단' THEN '공단'
        WHEN institution_name LIKE '%공사' THEN '공사'
        WHEN institution_name LIKE '%기관' THEN '기관'
        ELSE '기타'
      END as suffix_type,
      COUNT(*) as count
    FROM target_list_2025
    WHERE institution_name IS NOT NULL
    GROUP BY suffix_type
    ORDER BY count DESC
  `;

  console.log('Target List 접미사 분포:');
  targetSuffixes.forEach(row => {
    console.log(`  ${row.suffix_type}: ${row.count}건`);
  });

  // 2. aed_data 접미사 분석
  console.log('\n2. aed_data 접미사 분석');
  console.log('-------------------------------');

  const aedSuffixes = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN installation_institution LIKE '%보건소' THEN '보건소'
        WHEN installation_institution LIKE '%보건지소' THEN '보건지소'
        WHEN installation_institution LIKE '%소방서' THEN '소방서'
        WHEN installation_institution LIKE '%센터' THEN '센터'
        WHEN installation_institution LIKE '%병원' THEN '병원'
        WHEN installation_institution LIKE '%의원' THEN '의원'
        WHEN installation_institution LIKE '%의료원' THEN '의료원'
        WHEN installation_institution LIKE '%학교' THEN '학교'
        WHEN installation_institution LIKE '%대학' THEN '대학'
        WHEN installation_institution LIKE '%주민센터' THEN '주민센터'
        WHEN installation_institution LIKE '%행정복지센터' THEN '행정복지센터'
        WHEN installation_institution LIKE '%읍사무소' THEN '읍사무소'
        WHEN installation_institution LIKE '%면사무소' THEN '면사무소'
        WHEN installation_institution LIKE '%동사무소' THEN '동사무소'
        WHEN installation_institution LIKE '%파출소' THEN '파출소'
        WHEN installation_institution LIKE '%지구대' THEN '지구대'
        WHEN installation_institution LIKE '%경찰서' THEN '경찰서'
        WHEN installation_institution LIKE '%공단' THEN '공단'
        WHEN installation_institution LIKE '%공사' THEN '공사'
        WHEN installation_institution LIKE '%기관' THEN '기관'
        ELSE '기타'
      END as suffix_type,
      COUNT(*) as count
    FROM aed_data
    WHERE installation_institution IS NOT NULL
    GROUP BY suffix_type
    ORDER BY count DESC
  `;

  console.log('AED Data 접미사 분포:');
  aedSuffixes.forEach(row => {
    console.log(`  ${row.suffix_type}: ${row.count}건`);
  });

  // 3. 괄호 패턴 분석
  console.log('\n3. 괄호 포함 기관명 분석');
  console.log('-------------------------------');

  const parenthesesPatterns = await prisma.$queryRaw`
    SELECT
      'target_list' as source,
      COUNT(*) as total,
      SUM(CASE WHEN institution_name LIKE '%(%' THEN 1 ELSE 0 END) as with_parentheses
    FROM target_list_2025
    WHERE institution_name IS NOT NULL
    UNION ALL
    SELECT
      'aed_data' as source,
      COUNT(*) as total,
      SUM(CASE WHEN installation_institution LIKE '%(%' THEN 1 ELSE 0 END) as with_parentheses
    FROM aed_data
    WHERE installation_institution IS NOT NULL
  `;

  console.log('괄호 포함 비율:');
  parenthesesPatterns.forEach(row => {
    const total = Number(row.total);
    const withParentheses = Number(row.with_parentheses);
    const percentage = ((withParentheses / total) * 100).toFixed(2);
    console.log(`  ${row.source}: ${withParentheses}/${total} (${percentage}%)`);
  });

  // 4. 지역 접두어 패턴 분석
  console.log('\n4. 지역 접두어 패턴 분석');
  console.log('-------------------------------');

  const regionPrefixPatterns = await prisma.$queryRaw`
    SELECT
      'target_list' as source,
      SUM(CASE WHEN institution_name LIKE '서울%' THEN 1 ELSE 0 END) as seoul,
      SUM(CASE WHEN institution_name LIKE '부산%' THEN 1 ELSE 0 END) as busan,
      SUM(CASE WHEN institution_name LIKE '대구%' THEN 1 ELSE 0 END) as daegu,
      SUM(CASE WHEN institution_name LIKE '인천%' THEN 1 ELSE 0 END) as incheon,
      SUM(CASE WHEN institution_name LIKE '광주%' THEN 1 ELSE 0 END) as gwangju,
      SUM(CASE WHEN institution_name LIKE '대전%' THEN 1 ELSE 0 END) as daejeon,
      SUM(CASE WHEN institution_name LIKE '울산%' THEN 1 ELSE 0 END) as ulsan,
      SUM(CASE WHEN institution_name LIKE '세종%' THEN 1 ELSE 0 END) as sejong,
      SUM(CASE WHEN institution_name LIKE '경기%' THEN 1 ELSE 0 END) as gyeonggi,
      SUM(CASE WHEN institution_name LIKE '강원%' THEN 1 ELSE 0 END) as gangwon,
      SUM(CASE WHEN institution_name LIKE '충북%' OR institution_name LIKE '충청북도%' THEN 1 ELSE 0 END) as chungbuk,
      SUM(CASE WHEN institution_name LIKE '충남%' OR institution_name LIKE '충청남도%' THEN 1 ELSE 0 END) as chungnam,
      SUM(CASE WHEN institution_name LIKE '전북%' OR institution_name LIKE '전라북도%' THEN 1 ELSE 0 END) as jeonbuk,
      SUM(CASE WHEN institution_name LIKE '전남%' OR institution_name LIKE '전라남도%' THEN 1 ELSE 0 END) as jeonnam,
      SUM(CASE WHEN institution_name LIKE '경북%' OR institution_name LIKE '경상북도%' THEN 1 ELSE 0 END) as gyeongbuk,
      SUM(CASE WHEN institution_name LIKE '경남%' OR institution_name LIKE '경상남도%' THEN 1 ELSE 0 END) as gyeongnam,
      SUM(CASE WHEN institution_name LIKE '제주%' THEN 1 ELSE 0 END) as jeju
    FROM target_list_2025
    WHERE institution_name IS NOT NULL
    UNION ALL
    SELECT
      'aed_data' as source,
      SUM(CASE WHEN installation_institution LIKE '서울%' THEN 1 ELSE 0 END) as seoul,
      SUM(CASE WHEN installation_institution LIKE '부산%' THEN 1 ELSE 0 END) as busan,
      SUM(CASE WHEN installation_institution LIKE '대구%' THEN 1 ELSE 0 END) as daegu,
      SUM(CASE WHEN installation_institution LIKE '인천%' THEN 1 ELSE 0 END) as incheon,
      SUM(CASE WHEN installation_institution LIKE '광주%' THEN 1 ELSE 0 END) as gwangju,
      SUM(CASE WHEN installation_institution LIKE '대전%' THEN 1 ELSE 0 END) as daejeon,
      SUM(CASE WHEN installation_institution LIKE '울산%' THEN 1 ELSE 0 END) as ulsan,
      SUM(CASE WHEN installation_institution LIKE '세종%' THEN 1 ELSE 0 END) as sejong,
      SUM(CASE WHEN installation_institution LIKE '경기%' THEN 1 ELSE 0 END) as gyeonggi,
      SUM(CASE WHEN installation_institution LIKE '강원%' THEN 1 ELSE 0 END) as gangwon,
      SUM(CASE WHEN installation_institution LIKE '충북%' OR installation_institution LIKE '충청북도%' THEN 1 ELSE 0 END) as chungbuk,
      SUM(CASE WHEN installation_institution LIKE '충남%' OR installation_institution LIKE '충청남도%' THEN 1 ELSE 0 END) as chungnam,
      SUM(CASE WHEN installation_institution LIKE '전북%' OR installation_institution LIKE '전라북도%' THEN 1 ELSE 0 END) as jeonbuk,
      SUM(CASE WHEN installation_institution LIKE '전남%' OR installation_institution LIKE '전라남도%' THEN 1 ELSE 0 END) as jeonnam,
      SUM(CASE WHEN installation_institution LIKE '경북%' OR installation_institution LIKE '경상북도%' THEN 1 ELSE 0 END) as gyeongbuk,
      SUM(CASE WHEN installation_institution LIKE '경남%' OR installation_institution LIKE '경상남도%' THEN 1 ELSE 0 END) as gyeongnam,
      SUM(CASE WHEN installation_institution LIKE '제주%' THEN 1 ELSE 0 END) as jeju
    FROM aed_data
    WHERE installation_institution IS NOT NULL
  `;

  console.log('지역 접두어 분포:');
  regionPrefixPatterns.forEach(row => {
    console.log(`\n  ${row.source}:`);
    console.log(`    서울: ${Number(row.seoul)}건`);
    console.log(`    부산: ${Number(row.busan)}건`);
    console.log(`    대구: ${Number(row.daegu)}건`);
    console.log(`    인천: ${Number(row.incheon)}건`);
    console.log(`    광주: ${Number(row.gwangju)}건`);
    console.log(`    대전: ${Number(row.daejeon)}건`);
    console.log(`    울산: ${Number(row.ulsan)}건`);
    console.log(`    세종: ${Number(row.sejong)}건`);
    console.log(`    경기: ${Number(row.gyeonggi)}건`);
    console.log(`    강원: ${Number(row.gangwon)}건`);
    console.log(`    충북: ${Number(row.chungbuk)}건`);
    console.log(`    충남: ${Number(row.chungnam)}건`);
    console.log(`    전북: ${Number(row.jeonbuk)}건`);
    console.log(`    전남: ${Number(row.jeonnam)}건`);
    console.log(`    경북: ${Number(row.gyeongbuk)}건`);
    console.log(`    경남: ${Number(row.gyeongnam)}건`);
    console.log(`    제주: ${Number(row.jeju)}건`);
  });

  // 5. 상위 빈도 기관명 샘플
  console.log('\n5. 상위 빈도 기관명 샘플 (실제 데이터)');
  console.log('-------------------------------');

  const topInstitutions = await prisma.$queryRaw`
    SELECT institution_name, COUNT(*) as count
    FROM (
      SELECT institution_name FROM target_list_2025
      UNION ALL
      SELECT installation_institution as institution_name FROM aed_data
    ) combined
    WHERE institution_name IS NOT NULL
    GROUP BY institution_name
    ORDER BY count DESC
    LIMIT 20
  `;

  console.log('상위 20개 기관명:');
  topInstitutions.forEach((row, index) => {
    console.log(`  ${index + 1}. ${row.institution_name}: ${row.count}건`);
  });

  console.log('\n=== 분석 완료 ===');
}

analyzeInstitutionPatterns()
  .catch(console.error)
  .finally(() => prisma.$disconnect());