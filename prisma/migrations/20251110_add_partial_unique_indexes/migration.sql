-- AddPartialUniqueIndexes
-- 목적: Race condition 방지 및 데이터 무결성 강화
-- Schema: aedpics (DATABASE_URL의 schema parameter로 설정됨)

-- SET search_path를 사용하여 schema-qualified 이름 불필요
-- (DATABASE_URL의 schema=aedpics parameter와 일치)
SET search_path = aedpics;

-- ========================================
-- 1. inspection_sessions: Partial Unique Index
-- ========================================
-- 규칙: 같은 장비(equipment_serial)에서 활성(active) 또는 일시정지(paused) 상태인 세션은 최대 1개만 존재
--
-- 효과:
--   - INSERT 시 자동으로 중복 검사
--   - Transaction과 함께 race condition 완전 방지
--   - DB-level 제약으로 application-level 보호와 이중 방어
--
-- 주의: 기존 중복 세션이 있으면 인덱스 생성 실패
--       cleanup_duplicate_sessions.mjs로 먼저 정리 필요

DROP INDEX IF EXISTS idx_inspection_sessions_active_session_per_equipment;

CREATE UNIQUE INDEX idx_inspection_sessions_active_session_per_equipment
  ON inspection_sessions(equipment_serial)
  WHERE status IN ('active', 'paused');

-- ========================================
-- 2. inspection_schedules: 모니터링 인덱스 1
-- ========================================
-- 목적: 같은 장비의 일정을 빠르게 조회하여 중복 감지
--
-- 효과:
--   - GROUP BY aed_data_id, DATE(scheduled_for)로 같은 날짜의 여러 일정 조회 시 성능 향상
--   - 모니터링 API 쿼리 성능 개선
--
-- 참고: Partial unique index가 아닌 일반 인덱스
--       (±30분 윈도우는 application-level에서만 가능)

DROP INDEX IF EXISTS idx_inspection_schedules_equipment_date;

CREATE INDEX idx_inspection_schedules_equipment_date
  ON inspection_schedules(aed_data_id, scheduled_for);

-- ========================================
-- 3. inspection_schedules: 모니터링 인덱스 2
-- ========================================
-- 목적: 활성 일정만 빠르게 조회
--
-- 효과: status NOT IN ('cancelled') 상태인 일정을 조회할 때 성능 향상

DROP INDEX IF EXISTS idx_inspection_schedules_active;

CREATE INDEX idx_inspection_schedules_active
  ON inspection_schedules(aed_data_id, scheduled_for)
  WHERE status NOT IN ('cancelled');
