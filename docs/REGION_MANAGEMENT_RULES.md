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
*마지막 업데이트: 2025-11-08*