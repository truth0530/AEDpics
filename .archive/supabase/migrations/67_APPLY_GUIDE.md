# Migration 67 적용 가이드

## 📋 개요

**파일**: `67_improve_matching_algorithm_jaro_winkler.sql`
**목적**: Jaro-Winkler 알고리즘 적용으로 매칭 신뢰도 개선
**목표**: 평균 신뢰도 69.81점 → 80점 이상

---

## 🚀 적용 방법

### 방법 1: Supabase Dashboard SQL Editor (권장)

1. **Supabase Dashboard 접속**
   - URL: https://supabase.com/dashboard/project/aieltmidsagiobpuebvv
   - SQL Editor 메뉴 선택

2. **Migration 파일 내용 복사**
   ```bash
   cat supabase/migrations/67_improve_matching_algorithm_jaro_winkler.sql
   ```

3. **SQL Editor에 붙여넣기 및 실행**
   - 전체 SQL 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭
   - 성공 메시지 확인

4. **결과 확인**
   ```sql
   -- 함수 생성 확인
   SELECT routine_name
   FROM information_schema.routines
   WHERE routine_name IN (
     'jaro_winkler_similarity',
     'extract_core_keyword',
     'enhanced_name_similarity',
     'auto_match_single_aed',
     'get_matching_quality_stats'
   );
   ```

---

### 방법 2: Supabase CLI (로컬 개발)

```bash
# 1. Supabase 프로젝트 링크 (최초 1회)
npx supabase link --project-ref aieltmidsagiobpuebvv

# 2. Migration 푸시
SUPABASE_ACCESS_TOKEN="sbp_4c2437854b14fd1f5e6bd1d6cf59636d678d13f9" \
npx supabase db push --linked --include-all

# 3. 확인
npx supabase db remote list
```

---

## 🧪 테스트 및 검증

### 1단계: 샘플 테스트

```sql
-- 기존 vs 새 알고리즘 비교
SELECT
  '아산시보건소' as aed_name,
  '아산시보건소' as target_name,
  simple_similarity('아산시보건소', '아산시보건소') as old_score,
  enhanced_name_similarity('아산시보건소', '아산시보건소') as new_score
UNION ALL
SELECT
  '서울특별시동작구보건소' as aed_name,
  '동작구보건소' as target_name,
  simple_similarity('서울특별시동작구보건소', '동작구보건소') as old_score,
  enhanced_name_similarity('서울특별시동작구보건소', '동작구보건소') as new_score;
```

**예상 결과**:
- 완전 일치: `new_score` = 100점
- 부분 일치: `new_score` > `old_score` (10-30점 향상)

---

### 2단계: 단일 AED 매칭 테스트

```sql
-- 낮은 신뢰도 케이스 재매칭 테스트
SELECT * FROM auto_match_single_aed(
  (SELECT equipment_serial FROM aed_data
   WHERE management_number = '20120509-3' LIMIT 1)
);
```

**현재 상태 (Migration 67 적용 전)**:
- management_number: `20120509-3`
- old_confidence: 50.00점
- aed_inst: `둔덕동주민자치센터`
- target_inst: `의료법인한마음의료재단여수제일병원`
- name_score: 0.00점

**기대 결과 (Migration 67 적용 후)**:
- 더 적합한 target_institution 매칭
- 신뢰도 향상

---

### 3단계: 통계 확인

```sql
-- 현재 매칭 품질 통계
SELECT * FROM get_matching_quality_stats();
```

**예상 결과**:
| confidence_level | count | avg_confidence | percentage |
|------------------|-------|----------------|------------|
| high (≥90)      | 증가   | ~95점          | 40% 이상   |
| medium (70-89)  | 증가   | ~80점          | 30% 이상   |
| low (50-69)     | 감소   | ~60점          | 30% 이하   |

---

## 🔄 재매칭 실행 (선택적)

### 주의사항
- ⚠️ 재매칭은 시간이 오래 걸립니다 (50,010건)
- ⚠️ 확정된 매칭은 보존됩니다
- ⚠️ 실행 전 백업 테이블이 자동 생성됩니다

### 단계별 재매칭

#### 1단계: 백업 확인
```sql
-- 백업 테이블 존재 확인
SELECT COUNT(*) FROM management_number_group_mapping_backup_20251015;
```

#### 2단계: 재매칭 실행 (소규모 테스트)
```sql
-- 100건만 테스트
UPDATE management_number_group_mapping m
SET
  auto_suggested_2024 = am.target_key,
  auto_confidence_2024 = am.total_score,
  auto_matching_reason_2024 = am.matching_reason
FROM (
  SELECT DISTINCT ON (a.management_number)
    a.management_number,
    match.target_key,
    match.total_score,
    match.matching_reason
  FROM aed_data a
  CROSS JOIN LATERAL auto_match_single_aed(a.equipment_serial) as match
  WHERE a.management_number IN (
    SELECT management_number
    FROM management_number_group_mapping
    WHERE (confirmed_2024 = FALSE OR confirmed_2024 IS NULL)
      AND auto_confidence_2024 < 70
    LIMIT 100
  )
  ORDER BY a.management_number, match.total_score DESC
) am
WHERE m.management_number = am.management_number
  AND (m.confirmed_2024 = FALSE OR m.confirmed_2024 IS NULL);
```

#### 3단계: 결과 확인
```sql
-- 개선된 케이스 확인
SELECT
  m.management_number,
  old.auto_confidence_2024 as old_score,
  m.auto_confidence_2024 as new_score,
  (m.auto_confidence_2024 - old.auto_confidence_2024) as improvement
FROM management_number_group_mapping m
JOIN management_number_group_mapping_backup_20251015 old
  ON m.management_number = old.management_number
WHERE m.auto_confidence_2024 > old.auto_confidence_2024
ORDER BY improvement DESC
LIMIT 20;
```

#### 4단계: 전체 재매칭 (확인 후 실행)
```sql
-- 배치 재매칭 (100개씩, 70점 이상)
SELECT auto_match_batch(100, 70.0);

-- 진행 상황 확인
SELECT * FROM get_matching_quality_stats();

-- 반복 실행 (필요 시)
-- SELECT auto_match_batch(100, 70.0);
```

---

## 📊 성능 비교

### Before (Migration 44 - simple_similarity)

```
평균 신뢰도: 69.81점

신뢰도 분포:
- 고신뢰도 (≥90점): 10,630건 (21.3%)
- 중신뢰도 (70-89점): 8,810건 (17.6%)
- 저신뢰도 (<70점): 30,570건 (61.1%)

알고리즘:
- 시도 일치: 30점
- 구군 일치: 20점
- 기관명 유사도: 최대 50점 (공통 접두사 기반)
```

### After (Migration 67 - Jaro-Winkler) - 목표

```
평균 신뢰도: 80점 이상 (목표)

신뢰도 분포 (예상):
- 고신뢰도 (≥90점): 40% 이상
- 중신뢰도 (70-89점): 35% 이상
- 저신뢰도 (<70점): 25% 이하

알고리즘:
- 시도 일치: 35점 (+5)
- 구군 일치: 35점 (+15)
- 구비의무기관 일치: 10점 (신규)
- 기관명 유사도: 최대 30점 (Jaro-Winkler + 보너스)
  - Jaro-Winkler 기본 점수
  - 핵심 키워드 일치: +20점
  - 부분 문자열 포함: +10점
```

---

## 🐛 문제 해결

### 오류 1: `jarowinkler() does not exist`

**원인**: fuzzystrmatch 확장이 설치되지 않음

**해결**:
```sql
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
```

---

### 오류 2: `normalize_text() does not exist`

**원인**: Migration 44가 실행되지 않음

**해결**:
```bash
# Migration 44 먼저 실행
cat supabase/migrations/44_auto_matching_function.sql | \
  # SQL Editor에 붙여넣기
```

---

### 오류 3: 재매칭 시간이 너무 오래 걸림

**해결**: 배치 크기 조정
```sql
-- 10개씩 테스트
SELECT auto_match_batch(10, 70.0);

-- 성능 확인 후 100개씩
SELECT auto_match_batch(100, 70.0);
```

---

## ✅ 완료 체크리스트

- [ ] Migration 67 SQL 실행 완료
- [ ] 5개 함수 생성 확인
  - [ ] `jaro_winkler_similarity()`
  - [ ] `extract_core_keyword()`
  - [ ] `enhanced_name_similarity()`
  - [ ] `auto_match_single_aed()` (업데이트)
  - [ ] `get_matching_quality_stats()`
- [ ] 샘플 테스트 성공
- [ ] 단일 AED 매칭 테스트 성공
- [ ] 통계 확인 (개선 효과 확인)
- [ ] 재매칭 실행 (선택적)
- [ ] 최종 통계 80점 이상 달성

---

## 📝 다음 단계

1. ✅ Migration 67 적용
2. 🔄 UI에 2024년 탭 추가
3. 🔄 API에 연도 파라미터 추가
4. 📊 2025년 준비

---

**작성일**: 2025-10-15
**작성자**: Claude
**버전**: 1.0
