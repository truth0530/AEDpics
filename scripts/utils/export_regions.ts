#!/usr/bin/env ts-node

/**
 * lib/constants/regions.ts → JSON 파일로 export
 *
 * Python 스크립트(upload_to_ncp.py)에서 지역 정보를 사용하기 위한 중간 JSON 파일 생성
 *
 * Usage:
 *   npm run export:regions
 *   또는
 *   npx ts-node scripts/utils/export_regions.ts
 */

import fs from 'fs';
import path from 'path';
import {
  REGION_FULL_NAMES,
  REGION_LONG_LABELS,
  COMPOSITE_GUGUNS,
  REGION_CODE_TO_GUGUNS
} from '../../lib/constants/regions';

// Python에서 사용할 데이터 구조
interface RegionsData {
  // 약어 → 정식명칭 매핑 (예: "경북" → "경상북도")
  sido_mapping: Record<string, string>;

  // 통합시 하위 구 목록 (예: "천안시" → ["동남구", "서북구"])
  composite_guguns: Record<string, Record<string, string[]>>;

  // 시도별 구군 목록 (코드 기반)
  region_guguns: Record<string, string[]>;

  // 메타데이터
  _metadata: {
    source: string;
    generated_at: string;
    version: string;
  };
}

function main() {
  console.log('Exporting regions data from lib/constants/regions.ts...');

  // 1. sido_mapping 생성 (약어 및 정식명칭 → 정식명칭)
  const sidoMapping: Record<string, string> = {};

  // REGION_LONG_LABELS에서 모든 변형 → 코드 매핑
  const codeToFullName: Record<string, string> = REGION_FULL_NAMES.reduce(
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
  const compositeGugunsWithFullNames: Record<string, Record<string, string[]>> = {};
  for (const [regionCode, guguns] of Object.entries(COMPOSITE_GUGUNS)) {
    const fullName = codeToFullName[regionCode];
    if (fullName) {
      compositeGugunsWithFullNames[fullName] = guguns;
    }
  }

  // 3. region_guguns: 시도별 구군 목록 (코드 → 지역명)
  const regionGuguns: Record<string, string[]> = {};
  for (const [regionCode, guguns] of Object.entries(REGION_CODE_TO_GUGUNS)) {
    const fullName = codeToFullName[regionCode];
    if (fullName) {
      regionGuguns[fullName] = guguns;
    }
  }

  // 최종 데이터 구조
  const data: RegionsData = {
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

if (require.main === module) {
  main();
}
