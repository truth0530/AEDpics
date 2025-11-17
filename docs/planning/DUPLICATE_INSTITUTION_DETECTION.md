# 중복 의무시설 탐지 및 병합 설계

## 1. 성능 최적화된 탐지 쿼리

### 1.1 사전 준비 (데이터베이스 설정)

```sql
-- pg_trgm 익스텐션 활성화
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 기관명 유사도 검색을 위한 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_target_list_2025_institution_name_trgm
ON target_list_2025 USING GIN (institution_name gin_trgm_ops);

-- 지역 필터링을 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_target_list_2025_sido_gugun_name
ON target_list_2025 (sido, gugun, institution_name);

-- target_list_devices 성능 인덱스 확인/생성
-- (이미 존재: idx_target_devices_year_institution)
CREATE INDEX IF NOT EXISTS idx_target_devices_year_institution_serial
ON target_list_devices (target_list_year, target_institution_id, equipment_serial);
```

### 1.2 단계별 필터링 쿼리

**Step 1: 매칭불가 처리된 기관만 추출 (대상 좁히기)**
```sql
-- 약 28,862개 → 수백 개로 축소
CREATE TEMP TABLE unmatchable_targets AS
SELECT
  t.target_key,
  t.institution_name,
  t.sido,
  t.gugun,
  t.division,
  t.sub_division,
  t.address
FROM target_list_2025 t
WHERE t.data_year = 2025
  AND EXISTS (
    SELECT 1
    FROM target_list_match_logs logs
    WHERE logs.target_key = t.target_key
      AND logs.target_list_year = 2025
      AND logs.action = 'mark_unmatchable'
      AND NOT EXISTS (
        -- 취소되지 않은 것만
        SELECT 1
        FROM target_list_match_logs cancel_logs
        WHERE cancel_logs.target_key = logs.target_key
          AND cancel_logs.target_list_year = 2025
          AND cancel_logs.action = 'cancel_unmatchable'
          AND cancel_logs.created_at > logs.created_at
      )
  );

-- Index: 임시 테이블에도 인덱스 생성
CREATE INDEX ON unmatchable_targets (sido, gugun);
CREATE INDEX ON unmatchable_targets USING GIN (institution_name gin_trgm_ops);
```

**Step 2: 같은 지역 내에서만 비교 (CROSS JOIN 최소화)**
```sql
-- 수백 개 x 수백 개 (같은 구군 내) = 수만 건
CREATE TEMP TABLE duplicate_candidates AS
SELECT
  u.target_key as unmatchable_key,
  u.institution_name as unmatchable_name,
  u.sido,
  u.gugun,
  m.target_key as matched_key,
  m.institution_name as matched_name,
  SIMILARITY(u.institution_name, m.institution_name) as similarity_score,
  -- 주소 유사도도 추가 검증
  SIMILARITY(COALESCE(u.address, ''), COALESCE(m.address, '')) as address_similarity
FROM unmatchable_targets u
INNER JOIN target_list_2025 m
  ON m.sido = u.sido              -- 같은 시도
  AND m.gugun = u.gugun           -- 같은 구군
  AND m.data_year = 2025
  AND m.target_key != u.target_key
WHERE
  -- 유사도 임계값으로 1차 필터링
  SIMILARITY(u.institution_name, m.institution_name) > 0.6
  -- 매칭된 기관만 대상
  AND EXISTS (
    SELECT 1
    FROM target_list_devices tld
    WHERE tld.target_institution_id = m.target_key
      AND tld.target_list_year = 2025
  );
```

**Step 3: 매칭된 장비 정보 조회 (필요한 것만)**
```sql
SELECT
  dc.*,
  COUNT(DISTINCT tld.equipment_serial) as matched_device_count,
  COUNT(DISTINCT ad.management_number) as matched_mn_count,
  json_agg(
    DISTINCT jsonb_build_object(
      'management_number', ad.management_number,
      'equipment_count', (
        SELECT COUNT(*)
        FROM aed_data ad2
        WHERE ad2.management_number = ad.management_number
      )
    )
  ) as matched_groups
FROM duplicate_candidates dc
LEFT JOIN target_list_devices tld
  ON dc.matched_key = tld.target_institution_id
  AND tld.target_list_year = 2025
LEFT JOIN aed_data ad
  ON tld.equipment_serial = ad.equipment_serial
GROUP BY dc.unmatchable_key, dc.unmatchable_name, dc.sido, dc.gugun,
         dc.matched_key, dc.matched_name, dc.similarity_score, dc.address_similarity
HAVING COUNT(DISTINCT tld.equipment_serial) > 0
ORDER BY dc.similarity_score DESC, dc.address_similarity DESC;
```

**성능 예상**:
- 매칭불가 기관: ~500개
- 같은 구군 내 비교: 500 x 50 = 25,000건 (CROSS JOIN)
- 유사도 0.6 이상: ~100건
- **최종 결과: 수십~수백 건 (처리 가능한 수준)**

---

## 2. 검증 프로세스가 포함된 워크플로우

### 2.1 중복 의심 상태 관리

```sql
-- target_list_2025에 상태 필드 추가
ALTER TABLE target_list_2025
ADD COLUMN duplicate_status VARCHAR(20) DEFAULT 'normal'
  CHECK (duplicate_status IN ('normal', 'suspected', 'verified_duplicate', 'merged')),
ADD COLUMN suspected_at TIMESTAMPTZ,
ADD COLUMN suspected_by UUID REFERENCES user_profiles(id),
ADD COLUMN verified_at TIMESTAMPTZ,
ADD COLUMN verified_by UUID REFERENCES user_profiles(id),
ADD COLUMN merged_to VARCHAR(50),  -- FK는 별도 제약으로
ADD COLUMN merged_at TIMESTAMPTZ,
ADD COLUMN merged_by UUID REFERENCES user_profiles(id),
ADD COLUMN merge_reason TEXT;

-- 자기참조 FK (순환 방지)
ALTER TABLE target_list_2025
ADD CONSTRAINT fk_merged_to
  FOREIGN KEY (merged_to)
  REFERENCES target_list_2025(target_key)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 인덱스
CREATE INDEX idx_target_list_2025_duplicate_status
ON target_list_2025(duplicate_status)
WHERE duplicate_status != 'normal';
```

### 2.2 검증 워크플로우

```
1. [자동 탐지] → duplicate_status = 'suspected'
   ↓
2. [담당자 검토] → 댓글 작성, 추가 정보 입력
   ↓
3. [관리자 확인] → duplicate_status = 'verified_duplicate'
   ↓
4. [병합 실행] → duplicate_status = 'merged', merged_to 설정
   ↓
5. [감사 로그] → target_list_merge_logs 기록
```

### 2.3 검증 댓글 테이블

```sql
CREATE TABLE target_duplicate_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unmatchable_key VARCHAR(50) NOT NULL REFERENCES target_list_2025(target_key),
  matched_key VARCHAR(50) NOT NULL REFERENCES target_list_2025(target_key),
  target_list_year INT NOT NULL,

  -- 검토자 의견
  reviewer_id UUID NOT NULL REFERENCES user_profiles(id),
  review_type VARCHAR(20) NOT NULL CHECK (review_type IN ('confirm', 'reject', 'need_info')),
  comment TEXT,

  -- 추가 검증 정보
  verification_evidence JSON,  -- 증빙 자료 (사진, 문서 등)

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (unmatchable_key, matched_key, target_list_year, reviewer_id)
);
```

---

## 3. 안전한 병합 프로세스 (되돌리기 가능)

### 3.1 병합 전 스냅샷 저장

```sql
CREATE TABLE target_list_merge_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 병합 대상
  source_target_key VARCHAR(50) NOT NULL,
  destination_target_key VARCHAR(50) NOT NULL,
  target_list_year INT NOT NULL,

  -- 유사도 정보
  similarity_score NUMERIC(5, 2),
  address_similarity NUMERIC(5, 2),

  -- 병합 전 상태 스냅샷 (되돌리기용)
  source_snapshot JSON NOT NULL,  -- source의 전체 데이터
  destination_snapshot JSON NOT NULL,  -- destination의 전체 데이터
  affected_devices JSON NOT NULL,  -- 이전된 매칭 정보

  -- 병합 결과
  affected_device_count INT NOT NULL,
  affected_match_count INT NOT NULL,

  -- 병합 수행자
  merged_by UUID NOT NULL REFERENCES user_profiles(id),
  merged_at TIMESTAMPTZ DEFAULT NOW(),
  merge_reason TEXT,

  -- 되돌리기 상태
  is_reverted BOOLEAN DEFAULT FALSE,
  reverted_by UUID REFERENCES user_profiles(id),
  reverted_at TIMESTAMPTZ,
  revert_reason TEXT,

  CONSTRAINT fk_merged_by FOREIGN KEY (merged_by) REFERENCES user_profiles(id)
);

-- 인덱스
CREATE INDEX idx_merge_logs_source ON target_list_merge_logs(source_target_key, target_list_year);
CREATE INDEX idx_merge_logs_destination ON target_list_merge_logs(destination_target_key, target_list_year);
CREATE INDEX idx_merge_logs_reverted ON target_list_merge_logs(is_reverted) WHERE is_reverted = TRUE;
```

### 3.2 병합 프로시저 (트랜잭션)

```sql
CREATE OR REPLACE FUNCTION merge_duplicate_institutions(
  p_source_key VARCHAR(50),
  p_destination_key VARCHAR(50),
  p_year INT,
  p_user_id UUID,
  p_reason TEXT
) RETURNS JSON AS $$
DECLARE
  v_source_snapshot JSON;
  v_destination_snapshot JSON;
  v_affected_devices JSON;
  v_device_count INT;
  v_match_count INT;
  v_merge_log_id UUID;
BEGIN
  -- 1. 스냅샷 생성
  SELECT row_to_json(t) INTO v_source_snapshot
  FROM target_list_2025 t
  WHERE t.target_key = p_source_key AND t.data_year = p_year;

  SELECT row_to_json(t) INTO v_destination_snapshot
  FROM target_list_2025 t
  WHERE t.target_key = p_destination_key AND t.data_year = p_year;

  -- 2. 영향받는 매칭 정보 저장
  SELECT json_agg(tld) INTO v_affected_devices
  FROM target_list_devices tld
  WHERE tld.target_institution_id = p_destination_key
    AND tld.target_list_year = p_year;

  SELECT COUNT(*) INTO v_device_count
  FROM target_list_devices
  WHERE target_institution_id = p_destination_key
    AND target_list_year = p_year;

  SELECT COUNT(DISTINCT management_number) INTO v_match_count
  FROM target_list_devices tld
  JOIN aed_data ad ON tld.equipment_serial = ad.equipment_serial
  WHERE tld.target_institution_id = p_destination_key
    AND tld.target_list_year = p_year;

  -- 3. 병합 로그 생성
  INSERT INTO target_list_merge_logs (
    source_target_key, destination_target_key, target_list_year,
    source_snapshot, destination_snapshot, affected_devices,
    affected_device_count, affected_match_count,
    merged_by, merge_reason
  ) VALUES (
    p_source_key, p_destination_key, p_year,
    v_source_snapshot, v_destination_snapshot, v_affected_devices,
    v_device_count, v_match_count,
    p_user_id, p_reason
  ) RETURNING id INTO v_merge_log_id;

  -- 4. 매칭 데이터 복사 (destination → source)
  INSERT INTO target_list_devices (
    target_institution_id, equipment_serial, target_list_year,
    matching_method, matching_confidence, matched_by, matched_at
  )
  SELECT
    p_source_key,  -- 새로운 타겟
    equipment_serial, target_list_year,
    matching_method, matching_confidence, matched_by, matched_at
  FROM target_list_devices
  WHERE target_institution_id = p_destination_key
    AND target_list_year = p_year
  ON CONFLICT (target_list_year, equipment_serial) DO NOTHING;

  -- 5. source 상태 업데이트 (매칭불가 취소 로그)
  INSERT INTO target_list_match_logs (
    action, target_list_year, target_key,
    management_numbers, user_id, reason
  )
  SELECT
    'cancel_unmatchable',
    p_year,
    p_source_key,
    ARRAY(
      SELECT DISTINCT ad.management_number
      FROM target_list_devices tld
      JOIN aed_data ad ON tld.equipment_serial = ad.equipment_serial
      WHERE tld.target_institution_id = p_source_key
        AND tld.target_list_year = p_year
    ),
    p_user_id,
    'Merged from ' || p_destination_key || ': ' || COALESCE(p_reason, '');

  -- 6. destination을 중복으로 표시
  UPDATE target_list_2025
  SET
    duplicate_status = 'merged',
    merged_to = p_source_key,
    merged_at = NOW(),
    merged_by = p_user_id,
    merge_reason = p_reason
  WHERE target_key = p_destination_key
    AND data_year = p_year;

  -- 7. source를 정상으로 표시
  UPDATE target_list_2025
  SET duplicate_status = 'normal'
  WHERE target_key = p_source_key
    AND data_year = p_year;

  RETURN json_build_object(
    'success', TRUE,
    'merge_log_id', v_merge_log_id,
    'affected_devices', v_device_count,
    'affected_matches', v_match_count
  );
END;
$$ LANGUAGE plpgsql;
```

### 3.3 되돌리기 프로시저

```sql
CREATE OR REPLACE FUNCTION revert_institution_merge(
  p_merge_log_id UUID,
  p_user_id UUID,
  p_reason TEXT
) RETURNS JSON AS $$
DECLARE
  v_log RECORD;
BEGIN
  -- 1. 병합 로그 조회
  SELECT * INTO v_log
  FROM target_list_merge_logs
  WHERE id = p_merge_log_id
    AND is_reverted = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Merge log not found or already reverted';
  END IF;

  -- 2. 복사된 매칭 데이터 삭제
  DELETE FROM target_list_devices
  WHERE target_institution_id = v_log.source_target_key
    AND target_list_year = v_log.target_list_year
    AND equipment_serial IN (
      SELECT equipment_serial
      FROM json_to_recordset(v_log.affected_devices)
      AS x(equipment_serial VARCHAR)
    );

  -- 3. destination 상태 복원
  UPDATE target_list_2025
  SET
    duplicate_status = 'verified_duplicate',  -- 다시 검증된 상태로
    merged_to = NULL,
    merged_at = NULL,
    merged_by = NULL,
    merge_reason = NULL
  WHERE target_key = v_log.destination_target_key
    AND data_year = v_log.target_list_year;

  -- 4. source 상태 복원
  UPDATE target_list_2025
  SET duplicate_status = 'suspected'  -- 다시 의심 상태로
  WHERE target_key = v_log.source_target_key
    AND data_year = v_log.target_list_year;

  -- 5. 되돌리기 기록
  UPDATE target_list_merge_logs
  SET
    is_reverted = TRUE,
    reverted_by = p_user_id,
    reverted_at = NOW(),
    revert_reason = p_reason
  WHERE id = p_merge_log_id;

  RETURN json_build_object(
    'success', TRUE,
    'reverted_devices', v_log.affected_device_count
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 4. 단계적 자동화 계획

### Phase 1: 수동 검토 기반 (현재)
- 자동 탐지만 수행 (유사도 > 0.6)
- 모든 케이스를 담당자가 검토
- 관리자 승인 후 병합
- **목표**: 100건 수동 처리 → 병합 기준 검증

### Phase 2: 반자동 (3개월 후)
- 유사도 0.8~0.95: "검토 필요" (담당자 확인)
- 유사도 > 0.95: "자동 병합 후보" (관리자 승인만)
- **목표**: 고신뢰도 케이스 자동 분류

### Phase 3: 자동화 (6개월 후)
- 유사도 > 0.95 + 같은 주소: 자동 병합 (사후 알림)
- 유사도 0.8~0.95: "검토 필요"
- 유사도 < 0.8: 수동 처리
- **조건**: Phase 1/2에서 오류율 < 1%

---

## 5. 구현 체크리스트

### 데이터베이스 준비
- [ ] pg_trgm 익스텐션 활성화
- [ ] GIN 인덱스 생성 (institution_name)
- [ ] 복합 인덱스 생성 (sido, gugun, name)
- [ ] target_list_2025 필드 추가 (duplicate_status 등)
- [ ] target_duplicate_reviews 테이블 생성
- [ ] target_list_merge_logs 테이블 생성

### API 구현
- [ ] GET /api/compliance/duplicate-detection (탐지 쿼리)
- [ ] POST /api/compliance/duplicate-review (검토 의견)
- [ ] POST /api/compliance/merge-institutions (병합 실행)
- [ ] POST /api/compliance/revert-merge (되돌리기)
- [ ] GET /api/compliance/merge-history (병합 이력)

### UI 구현
- [ ] "중복 의심" 탭 추가
- [ ] 중복 케이스 목록 (유사도, 매칭 정보)
- [ ] 상세 비교 모달 (검증 정보 입력)
- [ ] 검토 댓글 기능
- [ ] 병합 확인 다이얼로그 (2단계 승인)
- [ ] 병합 이력 및 되돌리기 UI

### 테스트
- [ ] 쿼리 성능 테스트 (26,000건 대상)
- [ ] 병합 트랜잭션 무결성 테스트
- [ ] 되돌리기 기능 테스트
- [ ] 순환 참조 방지 테스트

---

## 6. 예상 성능

### 쿼리 실행 시간 (예상)
- Step 1 (매칭불가 추출): ~500ms
- Step 2 (같은 지역 비교): ~2초
- Step 3 (매칭 정보 조회): ~1초
- **총 처리 시간**: ~3.5초

### 최적화 목표
- 전체 처리 시간 < 5초
- UI 응답 시간 < 1초 (페이징)
- 병합 트랜잭션 < 1초
