# 주소 및 지역명 정규화 함수 사용 가이드

**작성일**: 2025-11-15
**목적**: 개발자가 적절한 정규화 함수를 선택할 수 있도록 명확한 가이드 제공

---

## 요약

프로젝트에는 4가지 정규화 전략이 있지만, 이들은 **서로 다른 목적**을 가진 보완적 함수들입니다.
혼용이 아니라 **올바른 관심사 분리(Separation of Concerns)**입니다.

---

## 1. 전체 주소 단축 - `shortenSidoInAddress()`

### 위치
`lib/utils/address-formatter.ts`

### 목적
전체 주소 문자열에서 긴 시도명을 짧은 형태로 변환하여 UI 공간 절약

### 사용 시기
- 테이블에서 주소 컬럼 표시
- 카드에서 주소 미리보기
- 지도 마커 툴팁

### 예시
```typescript
import { shortenSidoInAddress } from '@/lib/utils/address-formatter';

shortenSidoInAddress("대구광역시 중구 동덕로 167");
// → "대구 중구 동덕로 167"

shortenSidoInAddress("서울특별시 강남구 테헤란로 123");
// → "서울 강남구 테헤란로 123"
```

### 작동 방식
- `REGION_LONG_LABELS`의 모든 긴 형태를 짧은 형태로 치환
- "대구광역시" → "대구", "서울특별시" → "서울"
- 길이순 정렬로 긴 문자열부터 우선 처리 ("중앙대로" 부작용 방지)

---

## 2. 시도+구군 단축 - `shortenSidoGugun()`

### 위치
`lib/utils/address-formatter.ts`

### 목적
시도/구군 컬럼 표시용 (전체 주소가 아닌 "시도 구군" 형식)

### 사용 시기
- 테이블에서 sido/gugun 컬럼 결합 표시
- AED 데이터 상세 정보 표시

### 예시
```typescript
import { shortenSidoGugun } from '@/lib/utils/address-formatter';

shortenSidoGugun("대구광역시 중구");
// → "대구 중구"

shortenSidoGugun("서울특별시 강남구");
// → "서울 강남구"
```

### 작동 방식
- 내부적으로 `shortenSidoInAddress()` 호출 (동일 로직)
- 의미론적으로 구분하기 위한 별칭 함수

---

## 3. 지역명 축약 - `abbreviateRegion()`

### 위치
`lib/utils/region-utils.ts`

### 목적
**지역명만** 축약 (주소가 아님)

### 사용 시기
- 지역 선택 버튼 라벨
- 필터 드롭다운 옵션
- 대시보드 지역 헤더

### 예시
```typescript
import { abbreviateRegion } from '@/lib/utils/region-utils';

abbreviateRegion("서울특별시");    // → "서울"
abbreviateRegion("부산광역시");    // → "부산"
abbreviateRegion("경기도");        // → "경기"
abbreviateRegion("제주특별자치도"); // → "제주"
abbreviateRegion("도봉구");        // → "도봉구" (부작용 없음)
```

### 작동 방식
- 정규식으로 **끝에 있는** 접미사만 제거
- `.replace(/광역시$/g, '')`, `.replace(/도$/g, '')` 등
- 경계 조건 적용으로 "도봉구" → "도봉구" 부작용 방지 (2025-11-15 수정)

---

## 4. 보건소명 정규화 - `HealthCenterMatcher.normalizeForMatching()`

### 위치
`lib/utils/healthCenterMatcher.ts`

### 목적
보건소명 퍼지 매칭 (인트라넷 데이터 ↔ 회원가입 폼 매칭)

### 사용 시기
- 회원가입 시 보건소 자동 선택
- 인트라넷 데이터 import 시 기관 매칭
- 보건소명 검색 기능

### 예시
```typescript
import { HealthCenterMatcher } from '@/lib/utils/healthCenterMatcher';

HealthCenterMatcher.normalizeForMatching('대구광역시 중구보건소');
// → '중구'

HealthCenterMatcher.normalizeForMatching('대구광역시중구보건소');
// → '중구' (공백 무시)

HealthCenterMatcher.normalizeForMatching('중구보건소');
// → '중구' (시도명 없어도 정상 처리)
```

### 작동 방식
1. 공백 모두 제거
2. 시도 접미사 제거 (특별시, 광역시, 특별자치시, 특별자치도, 도)
3. 시도명 동적 제거 (`getRegionNamePatterns()` 사용)
4. '보건소' 접미사 제거
5. 소문자 변환

---

## 5. 유사도 매칭용 정규화 - `normalizeKoreanText()`

### 위치
`lib/utils/string-similarity.ts`

### 목적
Levenshtein 거리 계산 개선 (퍼지 검색)

### 사용 시기
- 기관명 유사도 검색
- 중복 데이터 감지
- 오타 허용 매칭

### 예시
```typescript
import { normalizeKoreanText } from '@/lib/utils/string-similarity';

normalizeKoreanText("광주광역시남구보건소");
// → "광주광시남구"
// ("광역시"를 완전히 제거하지 않고 "광시"로 축약)
```

### 작동 방식
- **부분 축약**: "광역시" → "광시", "특별시" → "특시", "자치도" → "도"
- **접사 제거**: "보건소", "센터", "병원", "주민센터" 등
- **목적**: 편집 거리 계산 시 정확도 향상

### 주의사항
- UI 표시용이 **아님**
- 내부 매칭 알고리즘용
- 사용자에게 보여주지 말 것

---

## 의사결정 플로우차트

```
주소/지역명을 처리해야 함
        │
        ├─ [전체 주소 문자열인가?]
        │   └─ YES → shortenSidoInAddress()
        │              예: "대구광역시 중구 동덕로 167" → "대구 중구 동덕로 167"
        │
        ├─ [시도+구군 두 컬럼인가?]
        │   └─ YES → shortenSidoGugun()
        │              예: "대구광역시 중구" → "대구 중구"
        │
        ├─ [지역명만 있나?]
        │   └─ YES → abbreviateRegion()
        │              예: "대구광역시" → "대구"
        │
        ├─ [보건소 이름 매칭인가?]
        │   └─ YES → HealthCenterMatcher.normalizeForMatching()
        │              예: "대구광역시중구보건소" → "중구"
        │
        └─ [유사도 검색인가?]
            └─ YES → normalizeKoreanText()
                       예: "광주광역시남구" → "광주광시남구"
```

---

## 사용 위치 예시

### DataTable (AED 목록)
```typescript
// ✅ 올바른 사용
import { shortenSidoInAddress } from '@/lib/utils/address-formatter';

<div title={device.installation_address || '주소 미등록'}>
  {shortenSidoInAddress(device.installation_address || '주소 미등록')}
</div>
```

### ComparisonView (지역 선택 버튼)
```typescript
// ✅ 올바른 사용
import { abbreviateRegion } from '@/lib/utils/region-utils';
import { REGION_FULL_NAME_LABELS } from '@/lib/constants/regions';

{REGION_FULL_NAME_LABELS.map(region => (
  <button>{abbreviateRegion(region)}</button>
))}
```

### LocalFullView (점검 이력 테이블)
```typescript
// ✅ 올바른 사용
import { shortenSidoGugun } from '@/lib/utils/address-formatter';

{inspection.aed_data && (inspection.aed_data.sido || inspection.aed_data.gugun)
  ? shortenSidoGugun(`${inspection.aed_data.sido || ''} ${inspection.aed_data.gugun || ''}`.trim())
  : '-'
}
```

---

## 잘못된 사용 예시

### ❌ 주소에 abbreviateRegion 사용
```typescript
// 잘못됨
abbreviateRegion("대구광역시 중구 동덕로 167");
// → "대구광역시 중구 동덕로 167" (변화 없음 - 전체 주소는 처리 안 함)

// 올바름
shortenSidoInAddress("대구광역시 중구 동덕로 167");
// → "대구 중구 동덕로 167"
```

### ❌ 지역명에 shortenSidoInAddress 사용
```typescript
// 비효율적 (작동은 하지만 불필요한 복잡도)
shortenSidoInAddress("대구광역시");
// → "대구" (작동하지만 abbreviateRegion이 더 적합)

// 올바름
abbreviateRegion("대구광역시");
// → "대구"
```

### ❌ UI 표시에 normalizeKoreanText 사용
```typescript
// 절대 금지
<div>{normalizeKoreanText(region)}</div>
// → "광시" (사용자에게 혼란)

// 올바름
<div>{abbreviateRegion(region)}</div>
// → "광주"
```

---

## 정리

| 함수 | 입력 예시 | 출력 예시 | 용도 |
|------|----------|----------|------|
| `shortenSidoInAddress()` | "대구광역시 중구 동덕로 167" | "대구 중구 동덕로 167" | 주소 표시 |
| `shortenSidoGugun()` | "대구광역시 중구" | "대구 중구" | 시도+구군 표시 |
| `abbreviateRegion()` | "대구광역시" | "대구" | 지역명 표시 |
| `HealthCenterMatcher.normalizeForMatching()` | "대구광역시중구보건소" | "중구" | 보건소 매칭 |
| `normalizeKoreanText()` | "광주광역시남구" | "광주광시남구" | 유사도 검색 (내부용) |

---

## 관련 문서

- [CLAUDE.md](../../CLAUDE.md) - 지역명 통합 관리 철칙
- [regions.ts](../../lib/constants/regions.ts) - 단일 진실 소스
- [address-formatter.ts](../../lib/utils/address-formatter.ts) - 주소 포매팅
- [region-utils.ts](../../lib/utils/region-utils.ts) - 지역 유틸리티
- [REGION_NORMALIZATION_FUNCTIONS.md](REGION_NORMALIZATION_FUNCTIONS.md) - 종합 함수 목록

---

**문서 버전**: 1.0
**최종 업데이트**: 2025-11-15
**검토자**: Claude Code
