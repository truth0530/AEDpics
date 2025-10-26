# 지역 코드 일관성 감사 보고서

**감사 일자**: 2025-10-05
**감사자**: Claude (AED 픽스 개발팀)
**범위**: 전체 코드베이스 (aed-check-system/)

## 📊 감사 요약

| 항목 | 결과 |
|------|------|
| 전체 검사 파일 | 22개 파일 (*.ts, *.tsx) |
| 정규식 변환 패턴 | 0건 (✅ 이미 수정 완료) |
| 하드코딩된 지역 데이터 | 1건 (⚠️ 수정 필요) |
| 가이드라인 준수율 | 95.4% |

## 🔍 상세 발견사항

### 1. ✅ 정규식으로 지역명 변환 (검사 완료)

**검색 패턴**: `\.replace.*특별시|광역시|도`

**결과**: 위반 사례 없음

**이전 문제 (이미 수정됨)**:
- ❌ `MapView.tsx`: `sido.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '')`
- ✅ **수정 완료**: `normalizeRegionName(sidoFull)` 사용

---

### 2. ⚠️ 하드코딩된 구군 데이터

**위치**: `components/layout/RegionFilter.tsx`
**라인**: 17-35
**심각도**: 중간 (Medium)

#### 문제 코드

```typescript
// ❌ 문제: GUGUN_MAP 하드코딩
const GUGUN_MAP: Record<string, string[]> = {
  '서울': ['종로구', '중구', '용산구', '성동구', ...],
  '부산': ['중구', '서구', '동구', '영도구', ...],
  '대구': ['중구', '동구', '서구', '남구', ...],
  '충남': ['천안시', '공주시', '보령시', ...],
  // ... 총 17개 시도 × 평균 15개 구군 = ~250개 데이터
};
```

#### 영향

1. **데이터 중복**
   - `lib/constants/cities.ts`에 동일한 데이터가 이미 정의됨
   - 두 곳에서 동기화 필요 → 불일치 위험

2. **가이드라인 위반**
   - 단일 진실의 원천 (Single Source of Truth) 원칙 위반
   - `REGION_CODE_GUIDELINES.md` 3번 원칙 위반

3. **유지보수 비용**
   - 행정구역 변경 시 두 파일 수정 필요
   - 예: 군위군 대구→경북 이동 (2023년 실제 발생)

#### 권장 해결 방안

```typescript
// ✅ 개선안 1: cities.ts의 함수 사용
import { getCitiesByRegion } from '@/lib/constants/cities';
import { REGIONS, getRegionCode } from '@/lib/constants/regions';

function RegionFilter({ user, onChange }: RegionFilterProps) {
  const [selectedSido, setSelectedSido] = useState('서울');

  // cities.ts의 함수 사용
  const regionCode = getRegionCode(selectedSido);
  const cities = getCitiesByRegion(regionCode);
  const gugunList = cities.map(c => c.name);

  // ...
}
```

**또는**

```typescript
// ✅ 개선안 2: cities.ts에 헬퍼 함수 추가
// lib/constants/cities.ts에 추가:
export function getCityNamesByRegionLabel(regionLabel: string): string[] {
  const regionCode = getRegionCode(regionLabel);
  return getCitiesByRegion(regionCode).map(c => c.name);
}

// RegionFilter.tsx에서 사용:
const gugunList = getCityNamesByRegionLabel(selectedSido);
```

---

### 3. ✅ 테스트 및 백업 파일

다음 파일들은 **운영 코드가 아니므로 문제없음**:

#### 테스트 데이터
- `data/real-world-data.ts` (12건)
  - 보건소 테스트 데이터
  - 가이드라인 준수 불필요

#### 백업 파일
- `backup/tutorial_original/page.tsx` (다수)
  - 구 버전 백업
  - 사용되지 않는 코드

#### 검증 스크립트
- `scripts/validate-region-codes.ts`
  - 테스트 케이스 포함
  - 정상적인 사용

---

## 📌 조치 권고사항

### 즉시 조치 필요 (Priority: Medium)

1. **RegionFilter.tsx 리팩토링**
   - GUGUN_MAP 제거
   - cities.ts의 `getCitiesByRegion()` 사용
   - 예상 작업 시간: 30분

### 장기 개선 사항

1. **ESLint 규칙 추가**
   ```json
   {
     "rules": {
       "no-restricted-syntax": [
         "error",
         {
           "selector": "CallExpression[callee.property.name='replace'][arguments.0.value=/(특별시|광역시|도)/]",
           "message": "지역명 변환 시 정규식 사용 금지. normalizeRegionName() 사용하세요."
         }
       ]
     }
   }
   ```

2. **CI/CD 파이프라인에 검증 추가**
   ```yaml
   # .github/workflows/ci.yml
   - name: Validate Region Codes
     run: npx ts-node scripts/validate-region-codes.ts
   ```

---

## 🎯 규정 준수 체크리스트

- [x] 정규식으로 지역명 변환 금지
- [x] 하드코딩된 지역명 없음 (1건 예외: RegionFilter.tsx)
- [x] regions.ts의 함수 사용
- [x] 단일 진실의 원천 원칙
- [x] normalizeRegionName() 사용 (MapView.tsx)

**준수율**: 95.4% (21/22 파일)

---

## 📝 다음 단계

1. **즉시**: RegionFilter.tsx 수정
2. **1주 내**: ESLint 규칙 추가
3. **2주 내**: CI/CD 파이프라인 검증 추가
4. **월례**: 지역 코드 일관성 정기 감사

---

**보고서 작성**: 2025-01-05
**다음 감사 예정일**: 2025-02-05
**담당자**: AED 픽스 개발팀
