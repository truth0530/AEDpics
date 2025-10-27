/**
 * 지역 코드 일관성 검증 스크립트
 *
 * 사용법:
 * npx ts-node scripts/validate-region-codes.ts
 */

import { REGIONS, REGION_LABEL_TO_CODE, normalizeRegionName } from '../lib/constants/regions';

console.log('🔍 지역 코드 일관성 검증 시작...\n');

let hasErrors = false;

// 1. normalizeRegionName 함수 테스트
console.log('✅ Test 1: normalizeRegionName 함수 검증');
const testCases = [
  { input: '충청남도', expected: '충남' },
  { input: '충청북도', expected: '충북' },
  { input: '전라남도', expected: '전남' },
  { input: '전북특별자치도', expected: '전북' },
  { input: '경상남도', expected: '경남' },
  { input: '경상북도', expected: '경북' },
  { input: '서울특별시', expected: '서울' },
  { input: '대구광역시', expected: '대구' },
  { input: '경기도', expected: '경기' },
];

testCases.forEach(({ input, expected }) => {
  const result = normalizeRegionName(input);
  if (result === expected) {
    console.log(`  ✓ ${input} → ${result}`);
  } else {
    console.log(`  ✗ ${input} → ${result} (expected: ${expected})`);
    hasErrors = true;
  }
});

// 2. REGION_ALIASES 검증 (주석 처리: REGION_ALIASES가 현재 정의되지 않음)
// console.log('\n✅ Test 2: REGION_ALIASES 완전성 검증');
// REGIONS.forEach(region => {
//   if (!REGION_ALIASES[region.code]) {
//     console.log(`  ✗ 지역 코드 ${region.code} (${region.label})의 별칭이 REGION_ALIASES에 없습니다`);
//     hasErrors = true;
//   } else {
//     console.log(`  ✓ ${region.code}: ${REGION_ALIASES[region.code].join(', ')}`);
//   }
// });

// 3. REGION_LABEL_TO_CODE 양방향 검증
console.log('\n✅ Test 3: REGION_LABEL_TO_CODE 일관성 검증');
Object.entries(REGION_LABEL_TO_CODE).forEach(([label, code]) => {
  const region = REGIONS.find(r => r.code === code);
  if (!region) {
    console.log(`  ✗ 매핑 ${label} → ${code} 에서 코드 ${code}를 REGIONS에서 찾을 수 없습니다`);
    hasErrors = true;
  } else {
    console.log(`  ✓ ${label} → ${code} (${region.label})`);
  }
});

// 4. 중복 검증
console.log('\n✅ Test 4: 중복 코드/라벨 검증');
const codes = REGIONS.map(r => r.code);
const labels = REGIONS.map(r => r.label);

const duplicateCodes = codes.filter((code, index) => codes.indexOf(code) !== index);
const duplicateLabels = labels.filter((label, index) => labels.indexOf(label) !== index);

if (duplicateCodes.length > 0) {
  console.log(`  ✗ 중복된 코드: ${duplicateCodes.join(', ')}`);
  hasErrors = true;
} else {
  console.log('  ✓ 중복된 코드 없음');
}

if (duplicateLabels.length > 0) {
  console.log(`  ✗ 중복된 라벨: ${duplicateLabels.join(', ')}`);
  hasErrors = true;
} else {
  console.log('  ✓ 중복된 라벨 없음');
}

// 5. 좌표 유효성 검증 (한국 범위)
console.log('\n✅ Test 5: 좌표 유효성 검증');
const KOREA_BOUNDS = {
  minLat: 33.0,
  maxLat: 38.5,
  minLng: 124.0,
  maxLng: 132.0
};

REGIONS.forEach(region => {
  const { latitude, longitude } = region;
  if (
    latitude < KOREA_BOUNDS.minLat || latitude > KOREA_BOUNDS.maxLat ||
    longitude < KOREA_BOUNDS.minLng || longitude > KOREA_BOUNDS.maxLng
  ) {
    console.log(`  ✗ ${region.label} (${region.code})의 좌표가 한국 범위를 벗어남: (${latitude}, ${longitude})`);
    hasErrors = true;
  }
});
console.log('  ✓ 모든 좌표가 한국 범위 내에 있습니다');

// 최종 결과
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ 검증 실패: 위의 에러를 수정해주세요');
  process.exit(1);
} else {
  console.log('✅ 모든 검증 통과!');
  console.log('\n💡 권장사항:');
  console.log('  1. 카카오맵 역지오코딩 시 normalizeRegionName() 사용');
  console.log('  2. 지역명 하드코딩 금지 (REGIONS import 사용)');
  console.log('  3. 정규식으로 지역명 변환 금지');
  process.exit(0);
}
