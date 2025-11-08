/**
 * RegionOrgData Factory 검증 스크립트 (2025-11-09)
 *
 * Phase 0 Step 3: Factory 함수가 올바르게 작동하는지 검증
 *
 * 실행: npx tsx scripts/test-org-factory.ts
 */

import { generateRegionOrganizations, validateRegionOrgData } from '../lib/services/orgFactory';
import { REGIONS } from '../lib/constants/regions';

async function main() {
  console.log('\n================================');
  console.log('RegionOrgData Factory 검증');
  console.log('================================\n');

  try {
    // 1. Factory 실행
    console.log('1. Factory 함수 실행 중...');
    const regionData = generateRegionOrganizations();
    console.log(`   ✓ ${regionData.length}개 지역 데이터 생성됨\n`);

    // 2. 각 지역별 상세 정보 확인
    console.log('2. 생성된 지역별 데이터 샘플:');
    console.log('   ─────────────────────────────────────');

    // 샘플 1: 중앙
    const kr = regionData[0];
    console.log(`   [KR] ${kr.region} (${kr.regionCode})`);
    console.log(`        - 정식명칭: ${kr.fullRegionName}`);
    console.log(`        - 조직 수: ${kr.organizations.length}`);
    console.log(`        - 구군 수: ${kr.guguns.length}`);
    console.log('');

    // 샘플 2: 서울
    const seoul = regionData[1];
    console.log(`   [SEO] ${seoul.region} (${seoul.regionCode})`);
    console.log(`        - 정식명칭: ${seoul.fullRegionName}`);
    console.log(`        - 조직 수: ${seoul.organizations.length}`);
    console.log(`        - 구군 수: ${seoul.guguns.length}`);
    console.log(`        - 조직 샘플: ${seoul.organizations.slice(0, 3).join(', ')}, ...`);
    console.log('');

    // 샘플 3: 세종 (특수 사례)
    const sejong = regionData.find(r => r.regionCode === 'SEJ');
    if (sejong) {
      console.log(`   [SEJ] ${sejong.region} (${sejong.regionCode})`);
      console.log(`        - 정식명칭: ${sejong.fullRegionName}`);
      console.log(`        - 조직 수: ${sejong.organizations.length}`);
      console.log(`        - 구군 수: ${sejong.guguns.length}`);
      console.log(`        - 구군: ${sejong.guguns.join(', ')}`);
    }
    console.log('   ─────────────────────────────────────\n');

    // 3. 검증 실행
    console.log('3. 검증 함수 실행 중...');
    validateRegionOrgData();

    // 4. 성공 메시지
    console.log('\n✓ 모든 검증 통과!');
    console.log('  • 17개 지역 생성 확인');
    console.log('  • guguns 배열 정확성 확인');
    console.log('  • region 필드 단축명 확인');
    console.log('  • organizations 첫 항목 확인');
    console.log('  • organizations 길이 확인');
    console.log('\n================================');
    console.log('RegionOrgData Factory 정상 작동!');
    console.log('================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 검증 실패:');
    console.error(error);
    console.error('\nFactory 구현을 다시 확인하세요.');
    process.exit(1);
  }
}

main();
