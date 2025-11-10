# Partial Unique Indexes Migration (2025-11-10)

## 목적

Race condition을 방지하고 데이터 무결성을 강화하기 위한 데이터베이스 레벨의 제약 추가

## 변경 사항

### 1. inspection_sessions - Partial Unique Index

#### SQL
```sql
CREATE UNIQUE INDEX idx_inspection_sessions_active_session_per_equipment
  ON aedpics.inspection_sessions(equipment_serial)
  WHERE status IN ('active', 'paused');
```

#### 목적
- 같은 장비(equipment_serial)에서 활성(active) 또는 일시정지(paused) 상태인 세션은 최대 1개만 존재하도록 강제
- Race condition 완전 방지: Application-level transaction과 DB-level constraint 이중 방어

#### 비즈니스 로직
- 점검 세션 생성 API: `POST /api/inspections/sessions`
- 룰: 이미 활성 세션이 있으면 누구든지 새로운 세션 생성 불가능
- Transaction 내에서 중복 체크 → 생성을 원자적으로 처리

#### 효과
```
// 성공 사례
[Equipment A]
- Session 1 (active): 14:00-14:15 ✓ (active 상태 1개)
- Session 2 (completed): 13:00-13:45 ✓ (completed는 제약 없음)

// 실패 사례
[Equipment B]
- Session 1 (active): 14:00 (진행 중)
- Session 2 (active): 14:05 ✗ 중복 시도 → INSERT 실패 (409 Conflict)
- Session 2 (paused): 14:05 ✗ 중복 시도 → INSERT 실패
```

#### 적용 시점
- 마이그레이션 적용 후부터는 모든 INSERT가 이 제약으로 검사됨
- 기존 중복 데이터는 인덱스 생성 실패로 인해 사전 정리 필요

### 2. inspection_schedules - 모니터링 인덱스

#### SQL
```sql
CREATE INDEX idx_inspection_schedules_equipment_date
  ON aedpics.inspection_schedules(aed_data_id, DATE(scheduled_for));

CREATE INDEX idx_inspection_schedules_active
  ON aedpics.inspection_schedules(aed_data_id, scheduled_for)
  WHERE status NOT IN ('cancelled');
```

#### 목적
- 같은 장비의 일정을 빠르게 조회하여 모니터링 성능 향상
- Full table scan 방지로 쿼리 성능 개선

#### 주의사항
- Partial unique index 아님 (±30분 윈도우 검증은 application-level에서만 가능)
- Transaction 기반 race condition 방지가 필수

## 마이그레이션 적용 전 필수 작업

### 1. 기존 중복 세션 정리

마이그레이션을 적용하기 전에 52개의 기존 중복 세션을 삭제해야 합니다.

```bash
# 중복 세션 확인
node scripts/find_duplicate_sessions.mjs

# 중복 세션 정리 (dry-run 먼저 확인 권장)
node scripts/cleanup_duplicate_sessions.mjs --dry-run
node scripts/cleanup_duplicate_sessions.mjs --apply
```

### 2. 마이그레이션 적용

```bash
# 프로덕션 환경에서 마이그레이션 적용
npx prisma migrate deploy

# 또는 수동으로 SQL 실행
psql -h <host> -U <user> -d aedpics_production -f migration.sql
```

## 검증 및 모니터링

### 마이그레이션 적용 후 검증

```sql
-- 1. 인덱스 생성 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'aedpics'
  AND indexname LIKE '%inspection_sessions_active%';

-- 2. inspection_sessions 중복 여부 확인 (0개여야 함)
SELECT equipment_serial, COUNT(*) as session_count
FROM aedpics.inspection_sessions
WHERE status IN ('active', 'paused')
GROUP BY equipment_serial
HAVING COUNT(*) > 1;

-- 3. inspection_schedules 일정 조회 성능 확인
EXPLAIN ANALYZE
SELECT * FROM aedpics.inspection_schedules
WHERE aed_data_id = <id> AND DATE(scheduled_for) = CURRENT_DATE;
```

### 운영 중 모니터링

```sql
-- 중복 세션 감지 (정상이면 0행)
SELECT equipment_serial, COUNT(*) as count,
       STRING_AGG(id::text, ',') as session_ids
FROM aedpics.inspection_sessions
WHERE status IN ('active', 'paused')
GROUP BY equipment_serial
HAVING COUNT(*) > 1;

-- 인덱스 사용률 확인
SELECT idx, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname IN (
  'idx_inspection_sessions_active_session_per_equipment',
  'idx_inspection_schedules_equipment_date',
  'idx_inspection_schedules_active'
);
```

## 롤백 방법

문제 발생 시 인덱스만 삭제하고 데이터는 보존됨:

```sql
DROP INDEX IF EXISTS idx_inspection_sessions_active_session_per_equipment;
DROP INDEX IF EXISTS idx_inspection_schedules_equipment_date;
DROP INDEX IF EXISTS idx_inspection_schedules_active;
```

## 영향받는 코드

### inspection_sessions API
- **파일**: `app/api/inspections/sessions/route.ts`
- **변경**: Transaction 래핑 (이미 구현됨)
- **동작**: 중복 요청 시 409 Conflict 반환

### inspection_schedules API
- **파일**: `app/api/schedules/route.ts`
- **변경**: Transaction 래핑 + buildScheduleWindow() 함수 사용
- **동작**: 중복 일정 감지 시 409 Conflict 반환

## 성능 영향

### inspection_sessions
- **INSERT**: 약간의 overhead (인덱스 유지)
- **SELECT**: 인덱스 활용으로 성능 개선 가능

### inspection_schedules
- **INSERT**: 두 개의 추가 인덱스로 약간의 overhead
- **SELECT**: 모니터링 쿼리 성능 대폭 개선

## 다음 단계

1. **Cleanup Script 개선** (Priority 2)
   - 현재: 하드코딩된 10개 serial
   - 필요: 동적 감지 및 정리

2. **Monitoring API** (Priority 2)
   - 엔드포인트: `GET /api/monitoring/duplicate-sessions`
   - 엔드포인트: `GET /api/monitoring/duplicate-schedules`

3. **Automated Cleanup** (Priority 3)
   - Cron job으로 주간 자동 정리
   - Slack 알림 통합

## 참고 문서

- [ROOT_CAUSE_ANALYSIS_DUPLICATE_SESSIONS.md](../../docs/troubleshooting/ROOT_CAUSE_ANALYSIS_DUPLICATE_SESSIONS.md)
- [DUPLICATE_PREVENTION_AUDIT_2025-11-10.md](../../docs/troubleshooting/DUPLICATE_PREVENTION_AUDIT_2025-11-10.md)
