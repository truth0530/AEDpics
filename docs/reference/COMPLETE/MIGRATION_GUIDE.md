# 데이터베이스 마이그레이션 가이드

**최종 업데이트**: 2025-10-09
**상태**: ✅ 운영 중 (43개 활성 마이그레이션)

---

## 📋 목차

1. [마이그레이션 개요](#마이그레이션-개요)
2. [실행 순서](#실행-순서)
3. [핵심 마이그레이션](#핵심-마이그레이션)
4. [주의사항](#주의사항)
5. [실패한 마이그레이션](#실패한-마이그레이션)
6. [향후 계획](#향후-계획)

---

## 마이그레이션 개요

### 현황

| 구분 | 개수 | 위치 |
|------|------|------|
| **활성 마이그레이션** | 43개 | `supabase/migrations/` |
| **실패 아카이브** | 17개 | `supabase/migrations/_archive_failed_attempts/` |
| **구 아카이브** | 7개 | `supabase/archived_migrations/` |
| **유틸리티 SQL** | 13개 | `supabase/` (루트) |

### 마이그레이션 번호 체계

```
00-19: 기본 스키마 및 초기 설정
20-39: 점검 시스템 및 기능 확장
40-49: 구비의무기관 매핑 시스템
50-56: 스냅샷 갱신 및 3-Tier 데이터
20YYMMDD_*: 날짜 기반 (특수 기능)
```

---

## 실행 순서

### Phase 1: 기본 스키마 (필수)

```sql
-- 1. 스키마 마이그레이션 추적 테이블
00_create_schema_migrations.sql

-- 2. 기본 테이블 생성 (user_profiles, organizations)
01_initial_schema.sql

-- 3. 초기 데이터 (Master 계정, 조직)
02_initial_data.sql

-- 4. Row Level Security 정책
03_rls_policies.sql

-- 5. AED 데이터 테이블 (aed_data, aed_inspections)
04_aed_tables.sql
```

**검증**:
```sql
-- 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('user_profiles', 'organizations', 'aed_data', 'aed_inspections');
```

### Phase 2: 팀 관리 및 확장 기능

```sql
-- 6. 팀 관리 시스템 (6개 테이블)
05_team_management.sql

-- 7. 점검 스키마 수정
06_fix_inspection_schema.sql

-- 8. AED 데이터 RLS 정책
10_aed_data_rls_policy.sql

-- 9. 알림 시스템
11_create_notifications.sql
12_fix_notification_policies.sql

-- 10. 로그인 추적
13_add_last_login.sql
14_login_tracking.sql

-- 11. 조직 변경 이력
15_organization_changes.sql
```

**검증**:
```sql
-- 팀 관리 테이블 확인
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'team_%';
```

### Phase 3: 점검 시스템 핵심 기능

```sql
-- 12. 점검 일정 관리
16_inspection_schedule_entries.sql

-- 13. 중복 장비 처리
17_duplicate_equipment_handling.sql

-- 14. 알림 시스템 확장
18_notification_system.sql

-- 15. GPS 이상 탐지
19_gps_issues_table.sql

-- 16. 점검 세션 시스템 ⭐
20_create_inspection_sessions.sql

-- 17. 보안: OTP 속도 제한
25_otp_rate_limiting.sql

-- 18. 세션 필드 변경 추적
28_add_field_changes_to_sessions.sql

-- 19. 조직 좌표 추가
31_add_coordinates_to_organizations.sql
```

**검증**:
```sql
-- inspection_sessions 테이블 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'inspection_sessions'
ORDER BY ordinal_position;
```

### Phase 4: 구비의무기관 매핑 시스템 ⭐⭐⭐

```sql
-- 20. 2024년 구비의무기관 데이터 ⭐
41_target_list_2024.sql
41_target_list_2024_upload.sql  -- 데이터 업로드

-- 21. 고유키 생성 함수
42_target_key_generation.sql

-- 22. 영속성 매핑 테이블 (핵심!) ⭐⭐⭐
43_aed_target_mapping.sql

-- 23. 자동 매칭 함수
44_auto_matching_function.sql

-- 24. 1:N 매핑 수정
45_fix_one_to_many_mapping.sql

-- 25. 관리번호 기반 자동 매칭
46_auto_match_management_number.sql

-- 26. 매칭 UI 함수
47_target_matching_ui_functions.sql
```

**핵심 검증**:
```sql
-- aed_target_mapping 레코드 수 확인 (80,900+ 예상)
SELECT COUNT(*) FROM aed_target_mapping;

-- 매핑 현황 통계
SELECT
  COUNT(*) FILTER (WHERE target_key_2024 IS NOT NULL) AS mapped_2024,
  COUNT(*) FILTER (WHERE confirmed_2024 = true) AS confirmed_2024,
  COUNT(*) FILTER (WHERE auto_suggested_2024 IS NOT NULL) AS suggested_2024,
  COUNT(*) AS total
FROM aed_target_mapping;
```

### Phase 5: 스키마 정합성 및 최적화

```sql
-- 27. 타입 불일치 수정
40_fix_varchar_text_mismatch.sql

-- 28. RPC 스키마 불일치 수정
48_fix_rpc_schema_mismatch.sql

-- 29. 지역명 단축어 수정
49_fix_region_short_names.sql

-- 30. SQL 타입 에러 수정
50_fix_sql_type_errors.sql
```

### Phase 6: 점검 테이블 개편

```sql
-- 31. 점검 테이블 이름 변경 (aed_inspections → inspections)
51_rename_inspection_tables.sql

-- 32. 점검 뷰 재생성
52_recreate_inspection_views.sql

-- 33. 점검 완료 RPC 재생성
53_recreate_complete_inspection_session_rpc.sql

-- 34. 일정 테이블 이름 변경
54_rename_aed_inspection_schedules.sql
```

**검증**:
```sql
-- inspections 테이블 존재 확인
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'inspections'
);

-- aed_inspections는 더 이상 존재하지 않아야 함
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_name = 'aed_inspections'
);
```

### Phase 7: 스냅샷 자동 갱신 시스템 v2.1 ⭐⭐⭐

```sql
-- 35. 스냅샷 자동 갱신 컬럼 추가 ⭐
55_add_snapshot_refresh_v2_1.sql

-- 36. 3-Tier 데이터 저장 ⭐
56_add_3tier_data_to_complete_inspection.sql
```

**핵심 검증**:
```sql
-- 스냅샷 컬럼 확인
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'inspection_sessions'
  AND column_name IN ('original_snapshot', 'current_snapshot', 'snapshot_updated_at');

-- 3-Tier 컬럼 확인
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'inspections'
  AND column_name IN ('original_data', 'registered_data', 'inspected_data');
```

### Phase 8: 점검 할당 시스템 (최신) ⭐

```sql
-- 37. 점검 할당 테이블 및 뷰
20251005_inspection_assignments.sql
```

**검증**:
```sql
-- inspection_assignments 테이블 및 뷰 확인
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('inspection_assignments', 'assigned_aed_list');

-- 현재 할당 건수 (18개 예상)
SELECT COUNT(*) FROM inspection_assignments;
```

### Phase 9: 감사 로그 (선택)

```sql
-- 38. 감사 로그 시스템
20250927_create_audit_logs.sql
20250927_safe_audit_logs_setup.sql
20250927_create_missing_tables.sql
```

---

## 핵심 마이그레이션

### 1. 영속성 매핑 시스템 (43_aed_target_mapping.sql) ⭐⭐⭐

**목적**: aed_data가 매일 교체되어도 구비의무기관 매핑 정보 보존

**핵심 테이블**:
```sql
CREATE TABLE aed_target_mapping (
  id UUID PRIMARY KEY,
  equipment_serial VARCHAR(255) UNIQUE NOT NULL,
  management_number VARCHAR(100) UNIQUE,

  -- 2024년 매핑
  target_key_2024 VARCHAR(255),
  auto_suggested_2024 VARCHAR(255),
  auto_confidence_2024 NUMERIC(5,2),
  confirmed_2024 BOOLEAN DEFAULT FALSE,

  -- 2025년 매핑 (준비)
  target_key_2025 VARCHAR(255),
  ...
);
```

**현재 상태**: 80,900+ 레코드 운영 중

**주의사항**:
- ❌ 절대 삭제 금지
- ❌ equipment_serial UNIQUE 제약조건 유지 필수
- ✅ 자동 복원 트리거 작동 확인

### 2. 스냅샷 자동 갱신 v2.1 (55_add_snapshot_refresh_v2_1.sql) ⭐⭐⭐

**목적**: 장시간 점검 시 등록 데이터 변경사항 자동 반영

**추가 컬럼**:
```sql
ALTER TABLE inspection_sessions
ADD COLUMN original_snapshot JSONB,      -- 시작 시점 (불변)
ADD COLUMN current_snapshot JSONB,       -- 갱신된 데이터 (가변)
ADD COLUMN snapshot_updated_at TIMESTAMPTZ,
ADD COLUMN last_accessed_at TIMESTAMPTZ,
ADD COLUMN refresh_status VARCHAR(20);
```

**하위 호환성**:
- `device_info` 컬럼 유지 (Week 4까지)
- 기존 세션 자동 마이그레이션
- Dual Read 패턴: `current_snapshot || device_info`

**주의사항**:
- ❌ Week 4 전에 device_info 삭제 금지
- ✅ 새 세션은 current_snapshot만 사용
- ✅ refresh_status = 'idle' 기본값

### 3. 3-Tier 데이터 저장 (56_add_3tier_data_to_complete_inspection.sql) ⭐⭐

**목적**: 점검 완료 시 3단계 데이터 모두 저장

**추가 컬럼**:
```sql
ALTER TABLE inspections
ADD COLUMN original_data JSONB,    -- 시작 시점 등록 데이터
ADD COLUMN registered_data JSONB,  -- 완료 시점 등록 데이터
ADD COLUMN inspected_data JSONB;   -- 점검자 입력 데이터
```

**데이터 흐름**:
```
inspection_sessions.original_snapshot → inspections.original_data
aed_data (완료 시점 조회)          → inspections.registered_data
inspection_sessions.step_data       → inspections.inspected_data
```

### 4. 점검 할당 시스템 (20251005_inspection_assignments.sql) ⭐

**목적**: 보건소 담당자의 점검 일정추가 및 관리

**핵심 테이블**:
```sql
CREATE TABLE inspection_assignments (
  id UUID PRIMARY KEY,
  equipment_serial VARCHAR(255) NOT NULL,
  assigned_to UUID NOT NULL,
  assigned_by UUID NOT NULL,
  scheduled_date DATE,
  status TEXT DEFAULT 'pending'
);
```

**핵심 뷰**:
```sql
CREATE VIEW assigned_aed_list AS
SELECT
  a.*,
  ia.assignment_id,
  ia.scheduled_date,
  latest_session.session_status,
  CASE
    WHEN ia.scheduled_date < CURRENT_DATE THEN 'overdue'
    WHEN ia.scheduled_date = CURRENT_DATE THEN 'today'
    ...
  END AS inspection_urgency
FROM aed_data a
INNER JOIN inspection_assignments ia ON ...;
```

**현재 상태**: 18개 할당 운영 중

---

## 주의사항

### 절대 금지 사항 ❌

1. **aed_target_mapping 테이블 삭제/수정 금지**
   - 80,900+ 매핑 정보 소실 위험
   - equipment_serial UNIQUE 제약조건 유지 필수

2. **device_info 컬럼 조기 삭제 금지**
   - Week 4 이전 삭제 시 하위 호환성 깨짐
   - 기존 세션 접근 불가

3. **마이그레이션 순서 변경 금지**
   - 의존성 문제로 실패 가능
   - 특히 40번대는 순서 중요

4. **RLS 정책 비활성화 금지**
   - 보안 취약점 발생
   - 데이터 무단 접근 위험

### 권장 사항 ✅

1. **마이그레이션 전 백업**
   ```bash
   # Supabase Dashboard → Database → Backups
   # 또는 pg_dump 사용
   ```

2. **검증 쿼리 실행**
   - 각 Phase 완료 후 검증 쿼리 실행
   - 레코드 수, 컬럼 존재 확인

3. **로그 확인**
   ```sql
   -- 마이그레이션 이력 확인
   SELECT * FROM schema_migrations
   ORDER BY applied_at DESC
   LIMIT 10;
   ```

4. **RPC 함수 재생성 확인**
   ```sql
   -- 함수 존재 확인
   SELECT routine_name, routine_type
   FROM information_schema.routines
   WHERE routine_schema = 'public'
   ORDER BY routine_name;
   ```

---

## 실패한 마이그레이션

### _archive_failed_attempts/ (17개)

| 파일 | 실패 원인 | 상태 |
|------|----------|------|
| `07_health_center_mapping.sql` | 보건소 ID 시스템 미구현 | ⚠️ 향후 재시도 필요 |
| `08_health_center_initial_data.sql` | 07번 의존성 | ⚠️ 향후 재시도 필요 |
| `26_region_code_migration.sql` | 컬럼 타입 불일치 | ✅ 40번으로 해결 |
| `27_persistent_mapping_table.sql` | 스키마 오류 | ✅ 43번으로 해결 |
| `30-39_*.sql` | RPC 함수 타입 오류 | ✅ 48-50번으로 해결 |

### 보건소 ID 시스템 (07-08) ⚠️

**현재 상태**: 구현 대기 (Phase 3 중)

**필요 작업**:
1. `health_centers` 테이블 생성 (341개 보건소)
2. `health_center_aliases` 테이블 생성
3. `user_profiles.health_center_id` 컬럼 추가
4. 기존 회원 마이그레이션

**참고 문서**: [QUICK_START.md](./QUICK_START.md) - 보건소 관리 시스템

---

## 향후 계획

### Week 2-3: API 전환

```typescript
// device_info → current_snapshot 전환
const sessionData = session.current_snapshot || session.device_info;
```

**마이그레이션 파일**: 없음 (코드 수정만)

### Week 4: device_info 제거

```sql
-- 57_remove_device_info.sql (예정)
ALTER TABLE inspection_sessions
DROP COLUMN IF EXISTS device_info;
```

**선행 조건**:
- ✅ 모든 API에서 current_snapshot 사용 확인
- ✅ 프론트엔드 전환 완료
- ✅ 기존 세션 마이그레이션 완료

### 2025 Q1: 보건소 ID 시스템

```sql
-- 57_health_center_id_system.sql (예정)
CREATE TABLE health_centers (...);
CREATE TABLE health_center_aliases (...);
ALTER TABLE user_profiles ADD COLUMN health_center_id UUID;
```

**선행 조건**:
- ✅ 341개 보건소 마스터 데이터 준비
- ✅ 별칭 데이터 정제
- ✅ 매칭 알고리즘 테스트

### 2025 Q2: 2025년 구비의무기관 매핑

```sql
-- 58_target_list_2025.sql (예정)
CREATE TABLE target_list_2025 (...);
-- aed_target_mapping의 2025 컬럼 활용
```

---

## 마이그레이션 체크리스트

### 신규 마이그레이션 작성 시

- [ ] 파일명 규칙 준수 (`NN_description.sql` 또는 `YYYYMMDD_description.sql`)
- [ ] `IF NOT EXISTS` / `IF EXISTS` 사용 (재실행 가능하도록)
- [ ] 롤백 전략 수립
- [ ] 검증 쿼리 포함 (`DO $$ ... END $$;` 블록)
- [ ] 인덱스 생성 (성능 최적화)
- [ ] RLS 정책 설정 (보안)
- [ ] 코멘트 추가 (문서화)
- [ ] 트리거 필요 여부 확인
- [ ] 의존성 확인 (다른 마이그레이션과의 관계)

### 마이그레이션 실행 전

- [ ] 백업 생성
- [ ] 의존성 마이그레이션 완료 확인
- [ ] 테스트 환경에서 먼저 실행
- [ ] 실행 시간 예측 (대량 데이터 시)
- [ ] 롤백 계획 수립

### 마이그레이션 실행 후

- [ ] 검증 쿼리 실행
- [ ] 로그 확인
- [ ] 레코드 수 확인
- [ ] RPC 함수 작동 확인
- [ ] API 테스트
- [ ] 프론트엔드 테스트

---

## 문제 해결

### 마이그레이션 실패 시

```sql
-- 1. 마이그레이션 이력 확인
SELECT * FROM schema_migrations
ORDER BY applied_at DESC;

-- 2. 오류 로그 확인 (Supabase Dashboard → Logs)

-- 3. 롤백 (수동)
-- 각 마이그레이션의 역순으로 DROP/ALTER 실행
```

### 타입 불일치 오류

```sql
-- 컬럼 타입 확인
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'your_table';

-- 타입 변경 (주의: 데이터 손실 가능)
ALTER TABLE your_table
ALTER COLUMN your_column TYPE TEXT;
```

### RPC 함수 오류

```sql
-- 함수 삭제 후 재생성
DROP FUNCTION IF EXISTS your_function CASCADE;

-- 함수 정의 확인
SELECT routine_definition
FROM information_schema.routines
WHERE routine_name = 'your_function';
```

---

## 참고 문서

- **시스템 문서**: [INSPECTION_SYSTEM.md](../planning/INSPECTION_SYSTEM.md)
- **매핑 시스템**: [MAPPING_SYSTEM.md](../planning/MAPPING_SYSTEM.md)
- **빠른 시작**: [QUICK_START.md](./QUICK_START.md)
- **프로젝트 상태**: [PROJECT_STATUS.md](../PROJECT_STATUS.md)

---

**작성**: AED Smart Check 개발팀
**최종 업데이트**: 2025-10-09
**상태**: ✅ 운영 중 (43개 활성 마이그레이션)
