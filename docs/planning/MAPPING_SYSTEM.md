# 매핑 시스템 통합 문서

**최종 업데이트**: 2025-10-10
**상태**: ✅ 구현 완료 및 운영 중 (2024년 기준 50,010개 매칭)
**통합 문서**: persistent-mapping-architecture.md, mandatory-institution-matching-plan.md

---

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [핵심 문제와 해결책](#핵심-문제와-해결책)
3. [데이터 구조](#데이터-구조)
4. [매칭 알고리즘](#매칭-알고리즘)
5. [연도별 업데이트 전략](#연도별-업데이트-전략)
6. [점검 시스템 통합](#점검-시스템-통합)
7. [구현 상태](#구현-상태)

---

## 시스템 개요

### 목적
**관리번호(management_number) 기반 그룹 매칭**을 통해 구비의무기관과 AED 장비를 연결하고, 연도별 의무시설 변경에 대응합니다.

### 핵심 개념
1. **관리번호 그룹 매칭**: 50,010개 관리번호 그룹을 26,724개 의무시설과 매칭
2. **연도별 매핑**: 2024/2025 컬럼 구조로 연도별 의무시설 변경 대응
3. **점검 시스템 통합**: 점검 시 의무시설 여부 자동 검증 및 기록

### 현재 상태 (2024년)
- **management_number_group_mapping**: 50,010개 관리번호 그룹 매칭 완료
- **target_list_2024**: 26,724개 의무시설 정의
- **커버리지**: 80,863대 AED (100%)
- **평균 신뢰도**: 69.81점

---

## 핵심 문제와 해결책

### 문제 시나리오

```
배경:
- aed_data: 80,863대 (매일 새벽 3시 Python 스크립트로 갱신 예정)
- target_list_2024: 26,724개 의무시설 (2024년 기준)
- target_list_2025: 미정 (2025년 Q2 예상)

문제1: aed_data는 equipment_serial 기준으로 UPSERT되므로 매핑 영속성 보장됨
문제2: 매년 의무시설 목록이 변경됨 (2024 → 2025 전환 시 재매칭 필요)
문제3: 2025년 의무시설인데 AED 미설치 시 매일 재확인 필요
```

### 해결책: 관리번호 그룹 + 연도별 컬럼 구조

```
┌──────────────────────────────────────────────────────────┐
│ aed_data (80,863대)                                      │
│ - management_number: 동일 관리번호 = 같은 기관의 AED      │
│ - 매일 갱신: Python UPSERT (equipment_serial)            │
│ - 점검 시스템: jurisdiction_health_center로 RLS 필터링   │
└─────────────────┬────────────────────────────────────────┘
                  │
                  │ management_number로 그룹화
                  ▼
┌──────────────────────────────────────────────────────────┐
│ management_number_group_mapping (50,010개)               │
│ - management_number: PRIMARY KEY                         │
│ - target_key_2024, auto_suggested_2024, confirmed_2024   │
│ - target_key_2025, auto_suggested_2025, confirmed_2025   │
│ → 연도별 컬럼으로 2024/2025 전환 대응                     │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ├─── target_list_2024 (26,724개) ← 2024년 의무시설
                  └─── target_list_2025 (미정) ← 2025년 의무시설 (예정)

┌──────────────────────────────────────────────────────────┐
│ inspections (점검 기록)                                   │
│ - target_key_2024, target_key_2025 (점검 시 기록)        │
│ - is_mandatory_facility: 의무시설 여부                    │
│ - matching_confidence: 매칭 신뢰도                        │
└──────────────────────────────────────────────────────────┘
```

---

## 데이터 구조

### aed_target_mapping (영속성 테이블)

**절대 삭제 금지 - 시스템의 핵심**

```sql
CREATE TABLE aed_target_mapping (
  -- 안정적 키
  equipment_serial VARCHAR(255) PRIMARY KEY,

  -- 매핑 정보 (영구 보존)
  target_institution_id INTEGER,
  FOREIGN KEY (target_institution_id)
    REFERENCES target_list_2024(id),

  -- 매칭 방법
  matching_method VARCHAR(50),  -- manual, auto, ai_suggested
  matching_confidence NUMERIC(5,2),  -- 0-100

  -- 추적 정보
  matched_by UUID,              -- 매칭 수행자
  matched_at TIMESTAMPTZ,       -- 매칭 시각
  verified_by UUID,             -- 검증자
  verified_at TIMESTAMPTZ,      -- 검증 시각

  -- 변경 이력
  change_history JSONB,         -- [{timestamp, old_id, new_id, changed_by}]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_target_mapping_institution
ON aed_target_mapping(target_institution_id);
```

**현재 레코드 수**: 80,900+ 개

### target_list_2024 (구비의무기관 리스트)

```sql
CREATE TABLE target_list_2024 (
  id SERIAL PRIMARY KEY,

  -- 지역 정보
  시도 VARCHAR(50),
  구군 VARCHAR(50),

  -- 기관 정보
  기관명 VARCHAR(255),
  주소 TEXT,

  -- 추가 정보
  연락처 VARCHAR(50),
  담당자 VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_target_list_region
ON target_list_2024(시도, 구군);

CREATE INDEX idx_target_list_name
ON target_list_2024(기관명);
```

### 자동 복원 트리거

aed_data INSERT 시 자동으로 매핑 정보 복원:

```sql
CREATE TRIGGER trigger_restore_target_mapping
  BEFORE INSERT ON aed_data
  FOR EACH ROW
  EXECUTE FUNCTION restore_target_mapping();

CREATE FUNCTION restore_target_mapping()
RETURNS TRIGGER AS $$
BEGIN
  -- aed_target_mapping에서 매핑 정보 조회
  SELECT target_institution_id INTO NEW.target_institution_id
  FROM aed_target_mapping
  WHERE equipment_serial = NEW.equipment_serial;

  IF FOUND THEN
    NEW.matching_status := 'matched';
  ELSE
    NEW.matching_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 매칭 알고리즘

### 1. 자동 매칭 (Auto Matching)

**주소 기반 매칭**:
```sql
-- 설치 주소와 기관 주소의 유사도 계산
SELECT
  a.equipment_serial,
  t.id as target_institution_id,
  similarity(a.installation_address, t.주소) as score
FROM aed_data a
CROSS JOIN target_list_2024 t
WHERE a.sido = t.시도
  AND a.gugun = t.구군
  AND similarity(a.installation_address, t.주소) > 0.7
ORDER BY score DESC;
```

**기관명 기반 매칭**:
```sql
-- 설치 기관명과 의무 기관명의 유사도 계산
SELECT
  a.equipment_serial,
  t.id as target_institution_id,
  similarity(a.installation_institution, t.기관명) as score
FROM aed_data a
CROSS JOIN target_list_2024 t
WHERE a.sido = t.시도
  AND similarity(a.installation_institution, t.기관명) > 0.8
ORDER BY score DESC;
```

### 2. 수작업 매칭 (Manual Matching)

**UI 워크플로우**:
1. 미매칭 AED 목록 표시
2. 관리자가 의무 기관 검색
3. 매칭 확정
4. aed_target_mapping에 영구 저장

```typescript
// API: POST /api/admin/mappings
{
  "equipmentSerial": "AED-12345",
  "targetInstitutionId": 123,
  "matchingMethod": "manual",
  "matchingConfidence": 100
}

// 결과: aed_target_mapping 테이블에 저장
// 이후 aed_data 교체 시 자동 복원됨
```

### 3. AI 추천 (AI Suggested)

**기계학습 기반 매칭 추천**:
```python
# 특징 벡터 생성
features = [
  address_similarity,
  institution_name_similarity,
  distance_km,
  historical_patterns
]

# 매칭 확률 예측
confidence = ml_model.predict(features)

# 80% 이상 신뢰도만 추천
if confidence > 0.8:
  suggest_matching(equipment_serial, target_id, confidence)
```

---

## 구현 상태

### ✅ 완료된 기능 (2025-10-09)

1. **데이터베이스 스키마**
   - aed_target_mapping 테이블 (80,900+ 레코드)
   - target_list_2024 테이블
   - 자동 복원 트리거

2. **매칭 시스템**
   - 수작업 매칭 UI
   - 주소 기반 자동 매칭
   - 기관명 기반 자동 매칭

3. **API 엔드포인트**
   - GET /api/admin/mappings (매핑 목록)
   - POST /api/admin/mappings (매칭 생성)
   - PUT /api/admin/mappings/:serial (매칭 업데이트)
   - DELETE /api/admin/mappings/:serial (매칭 삭제)

4. **영속성 보장**
   - aed_data 교체 시 자동 복원
   - 변경 이력 추적
   - 검증 상태 관리

### ⏳ 계획 중인 기능

1. **AI 매칭 추천**
   - 기계학습 모델 학습
   - 자동 추천 시스템

2. **매칭 검증 워크플로우**
   - 검증자 승인 프로세스
   - 매칭 품질 관리

3. **대량 매칭 도구**
   - CSV 업로드
   - 일괄 매칭 처리

---

## 운영 가이드

### 주의사항

**절대 금지 사항**:
1. ❌ aed_target_mapping 테이블 삭제 금지
2. ❌ trigger_restore_target_mapping 비활성화 금지
3. ❌ equipment_serial 변경 금지

**권장 사항**:
1. ✅ 주기적 백업 (매주 월요일 새벽)
2. ✅ 변경 이력 모니터링
3. ✅ 중복 매칭 확인

### 백업 및 복구

**백업**:
```bash
# 주기적 백업
pg_dump -t aed_target_mapping > backup_YYYYMMDD.sql
```

**복구**:
```bash
# 특정 시점 복원
psql < backup_20251009.sql
```

### 모니터링 쿼리

**미매칭 AED 확인**:
```sql
SELECT COUNT(*)
FROM aed_data a
LEFT JOIN aed_target_mapping m ON a.equipment_serial = m.equipment_serial
WHERE m.equipment_serial IS NULL;
```

**매칭 통계**:
```sql
SELECT
  matching_method,
  COUNT(*) as count,
  AVG(matching_confidence) as avg_confidence
FROM aed_target_mapping
GROUP BY matching_method;
```

**변경 이력 확인**:
```sql
SELECT *
FROM aed_target_mapping
WHERE change_history IS NOT NULL
  AND updated_at > NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;
```

---

## 마이그레이션

### ✅ 완료된 마이그레이션

| 번호 | 파일명 | 설명 | 실행일 |
|------|--------|------|--------|
| 41 | [41_target_list_2024.sql](../../supabase/migrations/41_target_list_2024.sql) | 2024년 구비의무기관 테이블 생성 | 2025-10-04 |
| 41-2 | [41_target_list_2024_upload.sql](../../supabase/migrations/41_target_list_2024_upload.sql) | 2024년 구비의무기관 데이터 업로드 | 2025-10-04 |
| 42 | [42_target_key_generation.sql](../../supabase/migrations/42_target_key_generation.sql) | 고유키 생성 함수 | 2025-10-04 |
| 43 | [43_aed_target_mapping.sql](../../supabase/migrations/43_aed_target_mapping.sql) | 영속성 매핑 테이블 (핵심) | 2025-10-04 |
| 44 | [44_auto_matching_function.sql](../../supabase/migrations/44_auto_matching_function.sql) | 자동 매칭 함수 | 2025-10-04 |
| 45 | [45_fix_one_to_many_mapping.sql](../../supabase/migrations/45_fix_one_to_many_mapping.sql) | 1:N 매핑 수정 | 2025-10-04 |
| 46 | [46_auto_match_management_number.sql](../../supabase/migrations/46_auto_match_management_number.sql) | 관리번호 기반 자동 매칭 | 2025-10-04 |
| 47 | [47_target_matching_ui_functions.sql](../../supabase/migrations/47_target_matching_ui_functions.sql) | 매칭 UI 함수 | 2025-10-04 |

**현재 상태**: 80,900+ 매핑 레코드 운영 중

### ⏳ 예정된 마이그레이션

| 번호 | 파일명 | 설명 | 예정일 |
|------|--------|------|--------|
| 58 | 58_target_list_2025.sql | 2025년 구비의무기관 테이블 생성 | 2025 Q2 |
| 59 | 59_auto_match_2025_functions.sql | 2025년 자동 매칭 함수 | 2025 Q2 |
| 60 | 60_inspection_mandatory_fields.sql | inspection 테이블에 의무시설 필드 추가 | 2025 Q1 |

### 📚 마이그레이션 상세 가이드

- [MIGRATION_GUIDE.md](../reference/MIGRATION_GUIDE.md) - 전체 마이그레이션 가이드
  - Phase 4: 구비의무기관 매핑 시스템 (41-47번)
  - 영속성 매핑 아키텍처 상세
  - 검증 쿼리 및 주의사항
  - 2025년 매핑 전환 계획

---

## 참고 문서

- **마이그레이션**: [MIGRATION_GUIDE.md](../reference/MIGRATION_GUIDE.md) - 데이터베이스 마이그레이션 전체 가이드
- **점검 시스템**: [INSPECTION_SYSTEM.md](./INSPECTION_SYSTEM.md) - 8단계 점검 프로세스
- **운영 정책**: [OPERATIONAL_POLICIES.md](./OPERATIONAL_POLICIES.md) - 점검 할당 정책
- **프로젝트 상태**: [PROJECT_STATUS.md](../PROJECT_STATUS.md)

---

**작성**: AED Smart Check 개발팀
**최종 업데이트**: 2025-10-09
**상태**: ✅ 운영 중
**레코드**: aed_target_mapping 80,900+ 개, target_list_2024 운영 중
