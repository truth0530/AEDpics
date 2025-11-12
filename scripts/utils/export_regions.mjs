#!/usr/bin/env node

/**
 * lib/constants/regions.ts → JSON 파일로 export
 *
 * Python 스크립트(upload_to_ncp.py)에서 지역 정보를 사용하기 위한 중간 JSON 파일 생성
 *
 * Usage:
 *   npm run export:regions
 *   또는
 *   node scripts/utils/export_regions.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM에서 __dirname 구하기
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// regions.ts에서 export한 데이터를 JavaScript로 재정의
// (import는 TypeScript 파일을 직접 불러올 수 없으므로 데이터 복사)

// REGION_FULL_NAMES
const REGION_FULL_NAMES = [
  { code: 'KR', label: '중앙' },
  { code: 'SEO', label: '서울특별시' },
  { code: 'BUS', label: '부산광역시' },
  { code: 'DAE', label: '대구광역시' },
  { code: 'INC', label: '인천광역시' },
  { code: 'GWA', label: '광주광역시' },
  { code: 'DAJ', label: '대전광역시' },
  { code: 'ULS', label: '울산광역시' },
  { code: 'SEJ', label: '세종특별자치시' },
  { code: 'GYE', label: '경기도' },
  { code: 'GAN', label: '강원특별자치도' },
  { code: 'CHB', label: '충청북도' },
  { code: 'CHN', label: '충청남도' },
  { code: 'JEB', label: '전북특별자치도' },
  { code: 'JEN', label: '전라남도' },
  { code: 'GYB', label: '경상북도' },
  { code: 'GYN', label: '경상남도' },
  { code: 'JEJ', label: '제주특별자치도' }
];

// REGION_LONG_LABELS (약어 및 긴 형식 → 코드 매핑)
const REGION_LONG_LABELS = {
  '중앙': 'KR',
  '서울특별시': 'SEO',
  '서울시': 'SEO',
  '서울': 'SEO',
  '부산광역시': 'BUS',
  '부산시': 'BUS',
  '부산': 'BUS',
  '대구광역시': 'DAE',
  '대구시': 'DAE',
  '대구': 'DAE',
  '인천광역시': 'INC',
  '인천시': 'INC',
  '인천': 'INC',
  '광주광역시': 'GWA',
  '광주시': 'GWA',
  '광주': 'GWA',
  '대전광역시': 'DAJ',
  '대전시': 'DAJ',
  '대전': 'DAJ',
  '울산광역시': 'ULS',
  '울산시': 'ULS',
  '울산': 'ULS',
  '세종특별자치시': 'SEJ',
  '세종시': 'SEJ',
  '세종': 'SEJ',
  '경기도': 'GYE',
  '경기': 'GYE',
  '강원특별자치도': 'GAN',
  '강원도': 'GAN',
  '강원': 'GAN',
  '충청북도': 'CHB',
  '충북': 'CHB',
  '충청남도': 'CHN',
  '충남': 'CHN',
  '전북특별자치도': 'JEB',
  '전라북도': 'JEB',
  '전북': 'JEB',
  '전라남도': 'JEN',
  '전남': 'JEN',
  '경상북도': 'GYB',
  '경북': 'GYB',
  '경상남도': 'GYN',
  '경남': 'GYN',
  '제주특별자치도': 'JEJ',
  '제주도': 'JEJ',
  '제주': 'JEJ'
};

// COMPOSITE_GUGUNS (통합시 하위 구)
const COMPOSITE_GUGUNS = {
  GYE: { // 경기도
    '수원시': ['장안구', '권선구', '팔달구', '영통구'],
    '성남시': ['수정구', '중원구', '분당구'],
    '고양시': ['덕양구', '일산동구', '일산서구'],
    '안산시': ['상록구', '단원구'],
    '안양시': ['만안구', '동안구'],
    '용인시': ['처인구', '기흥구', '수지구'],
  },
  CHB: { // 충청북도
    '청주시': ['상당구', '서원구', '흥덕구', '청원구'],
  },
  CHN: { // 충청남도
    '천안시': ['동남구', '서북구'],
  },
  JEB: { // 전북특별자치도
    '전주시': ['완산구', '덕진구'],
  },
  GYB: { // 경상북도
    '포항시': ['남구', '북구'],
  },
  GYN: { // 경상남도
    '창원시': ['의창구', '성산구', '마산합포구', '마산회원구', '진해구'],
  },
};

// REGION_CODE_TO_GUGUNS (시도별 구군 목록)
const REGION_CODE_TO_GUGUNS = {
  SEO: ['종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구'],
  BUS: ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'],
  DAE: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
  INC: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  GWA: ['동구', '서구', '남구', '북구', '광산구'],
  DAJ: ['동구', '중구', '서구', '유성구', '대덕구'],
  ULS: ['중구', '남구', '동구', '북구', '울주군'],
  SEJ: ['세종시'],
  GYE: ['수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시', '화성시', '평택시', '의정부시', '시흥시', '파주시', '김포시', '광명시', '광주시', '군포시', '오산시', '이천시', '양주시', '안성시', '구리시', '포천시', '의왕시', '하남시', '여주시', '양평군', '동두천시', '과천시', '가평군', '연천군'],
  GAN: ['춘천시', '원주시', '강릉시', '동해시', '태백시', '속초시', '삼척시', '홍천군', '횡성군', '영월군', '평창군', '정선군', '철원군', '화천군', '양구군', '인제군', '고성군', '양양군'],
  CHB: ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군'],
  CHN: ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군'],
  JEB: ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군'],
  JEN: ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군', '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군'],
  GYB: ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시', '군위군', '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군'],
  GYN: ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군'],
  JEJ: ['제주시', '서귀포시'],
};

function main() {
  console.log('Exporting regions data from lib/constants/regions.ts...');

  // 1. sido_mapping 생성 (약어 및 정식명칭 → 정식명칭)
  const sidoMapping = {};

  // 코드 → 정식명칭 매핑
  const codeToFullName = REGION_FULL_NAMES.reduce(
    (acc, { code, label }) => ({ ...acc, [code]: label }),
    {}
  );

  // 모든 변형(약어, 긴 형태) → 정식명칭 매핑
  for (const [variant, code] of Object.entries(REGION_LONG_LABELS)) {
    const fullName = codeToFullName[code];
    if (fullName) {
      sidoMapping[variant] = fullName;
    }
  }

  // 2. composite_guguns: 코드 → 지역명으로 변환
  const compositeGugunsWithFullNames = {};
  for (const [regionCode, guguns] of Object.entries(COMPOSITE_GUGUNS)) {
    const fullName = codeToFullName[regionCode];
    if (fullName) {
      compositeGugunsWithFullNames[fullName] = guguns;
    }
  }

  // 3. region_guguns: 시도별 구군 목록 (코드 → 지역명)
  const regionGuguns = {};
  for (const [regionCode, guguns] of Object.entries(REGION_CODE_TO_GUGUNS)) {
    const fullName = codeToFullName[regionCode];
    if (fullName) {
      regionGuguns[fullName] = guguns;
    }
  }

  // 최종 데이터 구조
  const data = {
    sido_mapping: sidoMapping,
    composite_guguns: compositeGugunsWithFullNames,
    region_guguns: regionGuguns,
    _metadata: {
      source: 'lib/constants/regions.ts',
      generated_at: new Date().toISOString(),
      version: '1.0.0'
    }
  };

  // JSON 파일로 저장
  const outputPath = path.join(__dirname, '../regions_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log('✓ Regions data exported successfully!');
  console.log(`  Output: ${outputPath}`);
  console.log(`  Sido mappings: ${Object.keys(data.sido_mapping).length} entries`);
  console.log(`  Composite guguns: ${Object.keys(data.composite_guguns).length} regions`);
  console.log(`  Region guguns: ${Object.keys(data.region_guguns).length} regions`);
}

main();
