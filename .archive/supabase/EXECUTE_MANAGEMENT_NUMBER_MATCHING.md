# 관리번호 기반 자동 매칭 실행 가이드

## 📋 실행 순서

### 1단계: 데이터 구조 분석
**파일**: `00_ANALYZE_DATA_STRUCTURE.sql`

Supabase Dashboard → SQL Editor에서 실행하여 현재 데이터 특성 파악:
- 카테고리별 분포
- 관리번호당 장비연번 개수
- 구비의무기관 vs 구비의무기관 외 비율

---

### 2단계: 1:N 매핑 스키마 적용
**파일**: `migrations/45_fix_one_to_many_mapping.sql`

실행 내용:
- `management_number_group_mapping` 테이블 생성
- `aed_target_mapping.management_number` UNIQUE 제약 제거
- `aed_with_target_2024` 뷰 업데이트 (개별 + 그룹 매핑 통합)
- `target_mapping_stats_2024` 뷰 업데이트
- `target_management_number_groups` 뷰 생성

---

### 3단계: 관리번호 자동 매칭 함수 생성
**파일**: `migrations/46_auto_match_management_number.sql`

생성되는 함수:
- `auto_match_single_management_number()`: 단일 관리번호 매칭
- `auto_match_management_numbers_batch()`: 일괄 매칭
- `confirm_management_number_match()`: 매칭 확정
- `modify_management_number_match()`: 매칭 수정
- `get_sample_management_numbers()`: 샘플 조회

---

## 🧪 샘플 테스트

### 1. 데이터 구조 확인

```sql
-- 카테고리별 분포
SELECT
  category,
  COUNT(*) as aed_count,
  COUNT(DISTINCT management_number) as unique_mgmt_numbers,
  ROUND(100.0 * COUNT(DISTINCT management_number) / COUNT(*), 2) as uniqueness_rate
FROM aed_data
WHERE category IS NOT NULL
GROUP BY category
ORDER BY aed_count DESC;
```

### 2. 샘플 관리번호 10개 조회

```sql
-- 구비의무기관만, 아직 매칭 안된 것
SELECT * FROM get_sample_management_numbers(NULL, 10);
```

### 3. 단일 관리번호 매칭 테스트

```sql
-- 위에서 조회한 샘플 management_number 중 하나 선택
SELECT * FROM auto_match_single_management_number('샘플_관리번호');
```

**예상 결과**:
```json
[
  {
    "target_key": "서울_강남_종합병원_1",
    "total_score": 95.5,
    "matching_reason": {
      "sido_match": true,
      "gugun_match": true,
      "sido_score": 30,
      "gugun_score": 20,
      "name_score": 45.5,
      "aed_institution": "강남세브란스병원",
      "target_institution": "강남세브란스병원"
    }
  },
  ...
]
```

### 4. 소규모 일괄 매칭 (10개)

```sql
-- 구비의무기관만 10개 매칭
SELECT * FROM auto_match_management_numbers_batch(NULL, 10);
```

### 5. 매칭 결과 확인

```sql
-- management_number_group_mapping 조회
SELECT
  management_number,
  auto_suggested_2024,
  auto_confidence_2024,
  confirmed_2024,
  auto_matching_reason_2024
FROM management_number_group_mapping
ORDER BY auto_confidence_2024 DESC
LIMIT 20;
```

### 6. 통합 뷰로 AED 데이터 확인

```sql
-- aed_data + 그룹 매핑 통합 조회
SELECT
  equipment_serial,
  management_number,
  institution_name,
  sido,
  gugun,
  category,

  -- 그룹 매핑 정보
  group_target_key_2024,
  group_auto_confidence_2024,
  group_confirmed_2024,

  -- 최종 매핑
  final_target_key_2024,
  final_confirmed_2024,
  matching_status_2024,
  matching_source,

  -- 구비의무기관 정보
  target_institution_name,
  target_division,
  target_sub_division

FROM aed_with_target_2024
WHERE group_target_key_2024 IS NOT NULL  -- 그룹 매핑된 것만
LIMIT 50;
```

### 7. 통계 확인

```sql
SELECT * FROM target_mapping_stats_2024;
```

**예상 결과** (10개 매칭 후):
```json
{
  "total_aed_devices": 80863,
  "confirmed_aed_count": 0,           // 아직 확정 안함
  "auto_suggested_aed_count": 123,    // 10개 관리번호에 속한 총 AED 개수
  "total_target_institutions": 26724,
  "matched_institution_count": 0,
  "aed_matching_rate": "0.00",
  "institution_matching_rate": "0.00",
  "avg_auto_confidence": 82.5,        // 자동 추천 평균 신뢰도
  "total_mgmt_number_groups": 10,     // 매칭된 관리번호 그룹 수
  "confirmed_mgmt_groups": 0
}
```

### 8. 매칭 확정 테스트

```sql
-- 신뢰도 높은 매칭 확정
SELECT confirm_management_number_match(
  '테스트_관리번호',
  '서울_강남_종합병원_1',
  2024
);
```

### 9. 1:N 매핑 확인 (1개 기관에 여러 관리번호)

```sql
-- 동일 target_key에 매핑된 관리번호 목록
SELECT * FROM target_management_number_groups
ORDER BY management_number_count DESC
LIMIT 20;
```

---

## 🚀 본격 실행

샘플 테스트가 성공하면 점진적으로 확대:

### 1. 중규모 배치 (1,000개)

```sql
SELECT * FROM auto_match_management_numbers_batch(NULL, 1000);
```

### 2. 대규모 배치 (10,000개)

```sql
SELECT * FROM auto_match_management_numbers_batch(NULL, 10000);
```

### 3. 전체 매칭

```sql
-- 모든 미매핑 관리번호 매칭 (시간 소요 예상: 10-30분)
SELECT * FROM auto_match_management_numbers_batch(NULL, 999999);
```

---

## 📊 성능 모니터링

```sql
-- 매칭 진행 상황
SELECT
  COUNT(*) as total_management_numbers,
  COUNT(*) FILTER (WHERE auto_suggested_2024 IS NOT NULL) as suggested,
  COUNT(*) FILTER (WHERE confirmed_2024 = TRUE) as confirmed,
  ROUND(AVG(auto_confidence_2024), 2) as avg_confidence
FROM management_number_group_mapping;

-- 신뢰도별 분포
SELECT
  CASE
    WHEN auto_confidence_2024 >= 90 THEN 'high (90+)'
    WHEN auto_confidence_2024 >= 70 THEN 'medium (70-89)'
    WHEN auto_confidence_2024 >= 50 THEN 'low (50-69)'
    ELSE 'very_low (<50)'
  END as confidence_level,
  COUNT(*) as count
FROM management_number_group_mapping
WHERE auto_confidence_2024 IS NOT NULL
GROUP BY confidence_level
ORDER BY MIN(auto_confidence_2024) DESC;
```

---

## ✅ 핵심 장점

### 효율성
- **1개 관리번호 매칭 = 여러 AED 동시 매칭**
- 예: 관리번호 1개에 AED 10대 → 10번 반복 불필요

### 유연성
- **1개 기관 = 여러 관리번호 지원**
- `target_management_number_groups` 뷰로 확인 가능

### 우선순위
- 개별 AED 매핑 우선
- 관리번호 그룹 매핑 보조
- `aed_with_target_2024` 뷰에서 자동 통합

---

## 🔍 문제 해결

### Q1: 매칭이 전혀 안되는 경우
```sql
-- '구비의무기관 외' 필터링 확인
SELECT category, COUNT(*)
FROM aed_data
WHERE management_number IS NOT NULL
GROUP BY category;
```

### Q2: 신뢰도가 너무 낮은 경우
```sql
-- 시도/구군 일치 여부 확인
SELECT
  a.sido as aed_sido,
  tl.sido as target_sido,
  COUNT(*) as mismatch_count
FROM aed_data a
CROSS JOIN target_list_2024 tl
WHERE a.sido != tl.sido
LIMIT 10;
```

### Q3: 중복 매칭 확인
```sql
-- 동일 target_key에 매핑된 관리번호 수
SELECT
  target_key_2024,
  COUNT(*) as mapping_count,
  ARRAY_AGG(management_number) as management_numbers
FROM management_number_group_mapping
WHERE confirmed_2024 = TRUE
GROUP BY target_key_2024
HAVING COUNT(*) > 1
ORDER BY mapping_count DESC;
```

---

준비 완료! 🎉
