# 의무기관 매칭 추천 기능 퇴보 분석 (2024→2025)

**분석일**: 2025-11-14
**상태**: 근본 원인 파악 완료
**심각도**: 높음 (기능 동작 하지만 신뢰도 40% 고착)

## 요약

사용자가 "광주남구보건소"를 검색하면 매칭 후보들이 모두 **40% 신뢰도**로 표시되는 문제입니다. 이는 2024년 데이터 삭제와 2025년 데이터 추가 후 발생했습니다.

**근본 원인**: API의 첫 번째 SQL 쿼리가 WHERE 절을 사용하지 않아 **모든 관리번호를 반환하면서 매칭되지 않은 항목에는 40% 신뢰도를 할당**합니다.

## 문제 상황

### 사용자 증상
```
입력: 광주남구보건소 (의무설치기관 선택)
현재 결과: 모든 후보가 40% 신뢰도 (당신이 마지막에 본 상황)
기대 결과: 90%+ 신뢰도로 관련 후보 표시
```

### 현재 코드의 신뢰도 분배
| 신뢰도 | 조건 | 쿼리 | 발생 상황 |
|--------|------|------|---------|
| 100% | 정확 일치 | Query 1,2,3 | 드문 경우 |
| 90% | 부분 일치 | Query 1,2,3 | 지역 필터 만족 + 이름 포함 |
| 85% | 역방향 일치 | Query 1,2,3 | 지역 필터 만족 + 역순 포함 |
| **40%** | **매칭 안 됨** | **Query 1 (시도+구군)** | **WHERE 절 없어서 모든 결과 반환** |
| 0% | 미선택 상태 | Query 4 | 의무설치기관 미선택 |

## 깊은 분석

### Query 1: 시도 + 구군 필터 (문제의 주범)

**파일**: `app/api/compliance/management-number-candidates/route.ts:96-162`

```sql
-- WHERE 절 없음! 모든 관리번호 반환
SELECT DISTINCT ON (ad.management_number)
  ad.management_number,
  ad.installation_institution,
  CASE
    WHEN ... THEN 100
    WHEN ... THEN 90
    WHEN ... THEN 85
    ELSE 40  -- 매칭 안 되면 40%로 할당
  END as confidence
FROM grouped_data gd
ORDER BY confidence DESC, equipment_count DESC
LIMIT 20;
```

**문제점**:
1. WHERE 절이 없어서 지정된 시도/구군의 **모든 관리번호가 반환됨**
2. 의무설치기관과 관계없이 모든 AED 설치기관이 후보가 됨
3. 이름이 매칭되지 않는 항목에는 자동으로 40% 할당
4. 이 40%은 퍼지 매칭 override를 통과하지 못함 (fuzzyConfidence > 40% 필요)

### Query 2: 시도만 필터 (올바른 방식)

**파일**: `app/api/compliance/management-number-candidates/route.ts:163-229`

```sql
-- WHERE 절 있음! 매칭된 항목만 반환
SELECT ...
FROM grouped_data gd
WHERE (
  REPLACE(gd.installation_institution, ' ', '') = REPLACE(${targetName}, ' ', '')
  OR REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${targetName}, ' ', '') || '%'
  OR REPLACE(${targetName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%'
)
ORDER BY confidence DESC, equipment_count DESC
LIMIT 20;
```

**장점**:
- WHERE 절로 매칭되는 항목만 필터링
- 따라서 반환되는 모든 항목은 90%, 85%, 또는 100% 신뢰도

## 근본 원인: Query 1의 설계 결함

### 원본 코드 (commit 1bcec6c, 2025-11-12)

```typescript
// 원본: 어떻게 작동했나?
if (!includeAllRegion && normalizedGugun) {
  // "시도 + 구군 필터"라고 명명했지만...
  autoSuggestionsQuery = await prisma.$queryRaw`
    ...
    ELSE 60  // 원본은 60
    ...
    FROM grouped_data gd
    -- WHERE 절 없음!
    ORDER BY confidence DESC, equipment_count DESC
    LIMIT 20
  `;
}
```

### 변경 이력

**git diff 결과**:
```diff
- ELSE 60
+ ELSE 40
```

이전 대화에서 ELSE 값을 60에서 40으로 낮췄습니다. 하지만 이것이 근본 문제는 아닙니다!

## 왜 Query 1에 WHERE 절이 없는가?

이것이 설계 오류인지 의도인지 파악하기 위해 git history를 검토했습니다:

1. **원본 commit (1bcec6c)**: Query 1은 처음부터 WHERE 절 없음
2. **다른 커밋들**: Query 2, 3은 WHERE 절 있음
3. **결론**: 의도적이었을 가능성 있음 (하지만 잘못된 설계)

## 퍼지 매칭이 작동 안 하는 이유

### 퍼지 매칭 로직 (lines 519-565)

```typescript
const fuzzyConfidence = calculateInstitutionMatchConfidence(
  item.institution_name,  // "OO 병원"
  targetName,             // "광주남구보건소"
  item.address,
  item.sido,
  targetSido
);

// 퍼지 신뢰도가 SQL 신뢰도보다 높아야 override
if (fuzzyConfidence > Number(item.confidence || 0)) {
  return { ...item, confidence: fuzzyConfidence };
}
```

### 문제 시나리오

1. SQL에서 item.confidence = **40** (ELSE 값)
2. calculateInstitutionMatchConfidence() 실행
   - 이름 비교: "OO병원" vs "광주남구보건소" → 낮은 점수
   - 주소 비교: 주소 정보 부족 → 0점
   - 지역 비교: 다른 구군 → 0점
   - **가중치 결과: null (70% 미만) 또는 40% 정도**
3. fuzzyConfidence ≤ 40% → override 안 됨
4. **결과: 40% 유지**

## 2024 vs 2025 데이터의 차이

사용자가 언급한 "2024년에는 잘 되던 기능":

### 가능한 이유들

1. **데이터 품질 차이**
   - 2024 데이터: 설치기관명이 정규화됨
   - 2025 데이터: 설치기관명 형식이 일치하지 않음
   - 결과: ILIKE 매칭 실패율 증가

2. **Query 로직 변경**
   - Query 1의 WHERE 절 삭제 (또는 처음부터 없었음)
   - 이전엔 Query 2를 사용했을 가능성
   - Query 2는 WHERE 절이 있어서 높은 신뢰도 반환

3. **지역 필터링 규칙 변경**
   - 2025: 구군까지 정확하게 필터링
   - 이전: 더 느슨한 필터링 (또는 includeAllRegion 사용)

## 현재 신뢰도 값 문제점

| 상황 | ELSE 60일 때 | ELSE 40일 때 | 개선 필요 |
|------|------------|-----------|---------|
| Query 1 비매칭 | 60% | 40% | WHERE 절 추가 필수 |
| Query 2 비매칭 | 불가능 | 불가능 | 이미 WHERE로 필터됨 |
| 퍼지 매칭 적용 | 가능할 수도 | 거의 불가능 | 신뢰도 60으로 복원 필요 |

## 해결 방안

### 방법 1: Query 1에 WHERE 절 추가 (권장)

**변경 전**:
```sql
FROM grouped_data gd
ORDER BY confidence DESC, equipment_count DESC
LIMIT 20
```

**변경 후**:
```sql
FROM grouped_data gd
WHERE (
  REPLACE(gd.installation_institution, ' ', '') = REPLACE(${targetName}, ' ', '')
  OR REPLACE(gd.installation_institution, ' ', '') ILIKE '%' || REPLACE(${targetName}, ' ', '') || '%'
  OR REPLACE(${targetName}, ' ', '') ILIKE '%' || REPLACE(gd.installation_institution, ' ', '') || '%'
)
ORDER BY confidence DESC, equipment_count DESC
LIMIT 20
```

**효과**: 매칭되지 않은 40% 항목들 제거 → 결과 품질 향상

### 방법 2: ELSE 값 복원 (임시 완화)

**변경**:
```sql
ELSE 60  -- 40에서 60으로 복원
```

**효과**: 퍼지 매칭이 더 쉽게 override 가능 (60% > fuzzyConfidence 필요)
**주의**: 근본 해결이 아님

### 방법 3: 퍼지 매칭 임계값 조정 (보조)

**파일**: `lib/utils/string-similarity.ts`

```typescript
// 현재
return weightedConfidence >= 50 ? weightedConfidence : null;

// 변경
return weightedConfidence >= 35 ? weightedConfidence : null;
```

**효과**: 더 낮은 점수도 override 가능
**주의**: 거짓 양성 증가 위험

## 권장 순서

**1단계 (즉시)**: ELSE 값을 60으로 복원
```bash
git diff app/api/compliance/management-number-candidates/route.ts
# ELSE 40 → ELSE 60으로 변경 (3곳)
```

**2단계 (1시간)**: Query 1에 WHERE 절 추가 (Query 2와 일치시키기)
```sql
# lines 159: ORDER BY 전에 WHERE 절 추가
WHERE (
  REPLACE(gd.installation_institution, ' ', '') = REPLACE(${targetName}, ' ', '')
  OR ...
)
```

**3단계 (테스트)**: "광주남구보건소" 검색 후 신뢰도 확인
```
기대: 90% 이상 또는 fuzzyConfidence로 override된 값
실제: 40% (확인)
```

## 추가 고찰

### Query 1이 WHERE 절 없는 이유

가능한 가설:
1. **점진적 필터링 의도**: 먼저 모든 결과를 반환한 후 클라이언트에서 필터링?
   - 하지만 API가 이미 필터링 함 → 모순

2. **성능 최적화**: DISTINCT ON이 WHERE 절보다 빠를 가능성?
   - 가능하지만 품질을 해침

3. **미완성 구현**: 부분적으로 완성된 코드?
   - Query 2는 WHERE 절이 있는데 Query 1은 없음 → 일관성 부족

4. **2024와의 호환성**: 2024 데이터로는 작동했나?
   - 2024 데이터가 더 잘 정규화되었으면 가능

## 결론

**근본 원인**: Query 1 (시도+구군 필터)에 WHERE 절이 없어서 모든 관리번호를 반환하면서, 매칭되지 않은 항목에 40% (원래는 60%) 신뢰도를 할당합니다.

**해결**: Query 1을 Query 2처럼 WHERE 절을 추가하여 매칭되는 항목만 반환하도록 수정해야 합니다.

**예상 효과**: 신뢰도 40% 항목 제거 → 90% 이상의 항목만 반환 → 추천 기능 정상 복구

---

**다음 단계**:
- [ ] 코드 수정 (Query 1 WHERE 절 추가)
- [ ] TypeScript 빌드 검증
- [ ] 테스트 ("광주남구보건소" 검색)
- [ ] 커밋 및 배포

**관련 파일**:
- app/api/compliance/management-number-candidates/route.ts (lines 96-162)
- lib/utils/string-similarity.ts
- docs/planning/TEMPORARY_FUZZY_MATCHING_IMPLEMENTATION.md
