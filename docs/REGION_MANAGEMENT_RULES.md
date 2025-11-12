# 지역명 관리 철칙

## 🚨 절대 규칙

### 1. 단일 진실 소스 (Single Source of Truth)
- **유일한 관리 파일**: `lib/constants/regions.ts`
- 다른 파일에서 지역명/구군명 하드코딩 **절대 금지**

### 2. 금지 사항
```typescript
// ❌ 절대 하지 말 것
const GUGUN_MAP = {
  '서울': ['종로구', '중구', ...]  // 하드코딩 금지!
}

// ❌ 절대 하지 말 것
city_code: 'gimhae'  // 하드코딩 금지!

// ❌ 절대 하지 말 것
if (sido === '서울') { ... }  // 하드코딩 금지!
```

### 3. 올바른 사용법
```typescript
// ✅ 반드시 이렇게
import {
  REGIONS,
  CITY_CODE_TO_GUGUN_MAP,
  mapCityCodeToGugun,
  extractRegionFromOrgName,
  normalizeRegionName
} from '@/lib/constants/regions';

// ✅ 지역 코드 사용
const region = REGIONS.find(r => r.code === 'SEO');

// ✅ city_code → 구군 변환
const gugun = mapCityCodeToGugun(cityCode);

// ✅ 조직명에서 지역 추출
const { sido, gugun } = extractRegionFromOrgName(orgName);
```

## 📝 체크리스트

### 새 기능 개발 시
- [ ] 지역명이 필요한가? → `lib/constants/regions.ts` import
- [ ] 구군 목록이 필요한가? → `CITY_CODE_TO_GUGUN_MAP` 사용
- [ ] 지역 정규화가 필요한가? → `normalizeRegionName()` 사용
- [ ] 새로운 매핑이 필요한가? → `lib/constants/regions.ts`에 추가

### 코드 리뷰 시
- [ ] 하드코딩된 지역명이 있는가? → 거부
- [ ] '서울', '부산' 등 문자열이 있는가? → 거부
- [ ] city_code를 직접 생성하는가? → 거부

## 🔧 자주 쓰는 함수

### 1. 지역 코드 ↔ 이름 변환
```typescript
import { getRegionCode, getRegionLabel } from '@/lib/constants/regions';

const code = getRegionCode('서울');  // 'SEO'
const label = getRegionLabel('SEO'); // '서울'
```

### 2. city_code → 구군명
```typescript
import { mapCityCodeToGugun } from '@/lib/constants/regions';

const gugun = mapCityCodeToGugun('gangnam'); // '강남구'
```

### 3. 조직명 → 지역 정보
```typescript
import { extractRegionFromOrgName } from '@/lib/constants/regions';

const { sido, gugun } = extractRegionFromOrgName('서울특별시 강남구 보건소');
// { sido: '서울', gugun: '강남구' }
```

### 4. 정규화
```typescript
import { normalizeRegionName } from '@/lib/constants/regions';

normalizeRegionName('서울특별시'); // '서울'
normalizeRegionName('서울시');     // '서울'
normalizeRegionName('서울');      // '서울'
```

## 🐍 Python 스크립트에서 사용

Python 스크립트(예: `upload_to_ncp.py`)는 TypeScript를 직접 import할 수 없으므로, JSON 중간 파일을 사용합니다.

### 1. JSON 파일 생성 (최초 1회 또는 regions.ts 업데이트 시)

```bash
npm run export:regions
```

이 명령은 `scripts/regions_data.json` 파일을 생성합니다.

### 2. Python에서 사용

```python
import json
from pathlib import Path

# JSON 파일 로드
regions_json_path = Path(__file__).parent / 'regions_data.json'
with open(regions_json_path, 'r', encoding='utf-8') as f:
    regions_data = json.load(f)
    sido_mapping = regions_data['sido_mapping']  # 약어 → 정식명칭
    composite_guguns = regions_data['composite_guguns']  # 통합시 하위 구
    region_guguns = regions_data['region_guguns']  # 시도별 구군 목록

# 사용 예시
for sido_key in sorted(sido_mapping.keys(), key=len, reverse=True):
    if address.startswith(sido_key):
        sido = sido_mapping[sido_key]  # "경북" → "경상북도"
        break
```

### 3. 자동화

`lib/constants/regions.ts`를 업데이트한 후 반드시 실행:

```bash
npm run export:regions
```

**중요**: Python 스크립트 실행 전 regions_data.json이 최신 상태인지 확인하세요.

## ⚠️ 레거시 코드 정리 대상

다음 파일들은 즉시 수정 필요:
1. `components/layout/RegionFilter.tsx` - GUGUN_MAP 하드코딩 제거
2. 모든 scripts/*.ts - city_code 하드코딩 제거
3. API 라우트 - 지역명 하드코딩 제거

## 📅 정기 점검

매주 금요일:
```bash
# 하드코딩 검사
grep -r "서울\|부산\|대구" --include="*.ts" --include="*.tsx" | grep -v "lib/constants/regions.ts"

# city_code 하드코딩 검사
grep -r "city_code.*['\"]" --include="*.ts" --include="*.tsx" | grep -v "lib/constants/regions.ts"
```

## 🎯 목표

**"lib/constants/regions.ts 외에는 지역명이 하나도 없는 코드베이스"**

---

*이 규칙은 CLAUDE.md와 README.md에도 반영되어야 합니다.*
*마지막 업데이트: 2025-11-12*