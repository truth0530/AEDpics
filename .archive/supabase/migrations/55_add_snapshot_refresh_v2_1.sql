-- ==========================================
-- Week 1 Phase 1: 스냅샷 자동 갱신 시스템 구축
-- 버전: v2.1
-- 목적: 하위 호환성 100% 유지하면서 새 컬럼 추가
-- 작성일: 2025-10-09
-- ==========================================

-- ==========================================
-- 1. 기본 스냅샷 컬럼 추가
-- ==========================================

ALTER TABLE inspection_sessions
ADD COLUMN IF NOT EXISTS original_snapshot JSONB,
ADD COLUMN IF NOT EXISTS current_snapshot JSONB,
ADD COLUMN IF NOT EXISTS snapshot_updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();

-- ==========================================
-- 2. 갱신 상태 관리 컬럼 추가
-- ==========================================

ALTER TABLE inspection_sessions
ADD COLUMN IF NOT EXISTS refresh_status VARCHAR(20) DEFAULT 'idle'
  CHECK (refresh_status IN ('idle', 'refreshing', 'success', 'failed')),
ADD COLUMN IF NOT EXISTS refresh_error TEXT;

-- ==========================================
-- 3. 기존 데이터 동기화 (device_info → snapshots)
-- ==========================================

-- 기존 세션들의 device_info를 새 컬럼으로 복사
UPDATE inspection_sessions
SET original_snapshot = device_info,
    current_snapshot = device_info,
    snapshot_updated_at = started_at,
    last_accessed_at = COALESCE(updated_at, started_at),
    refresh_status = 'idle'
WHERE device_info IS NOT NULL
  AND original_snapshot IS NULL;

-- device_info가 NULL인 세션 처리
UPDATE inspection_sessions
SET original_snapshot = '{}'::jsonb,
    current_snapshot = '{}'::jsonb,
    snapshot_updated_at = started_at,
    last_accessed_at = COALESCE(updated_at, started_at),
    refresh_status = 'idle'
WHERE device_info IS NULL
  AND original_snapshot IS NULL;

-- ==========================================
-- 4. 인덱스 추가 (성능 최적화)
-- ==========================================

-- equipment_serial 조회용 (aed_data 연계)
CREATE INDEX IF NOT EXISTS idx_sessions_equipment_serial
ON inspection_sessions(equipment_serial);

-- 갱신 정책 체크용 (부분 인덱스)
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_check
ON inspection_sessions(status, snapshot_updated_at)
WHERE status IN ('draft', 'active');

-- 세션 정리용 (부분 인덱스)
CREATE INDEX IF NOT EXISTS idx_stale_sessions
ON inspection_sessions(last_accessed_at)
WHERE status = 'draft';

-- aed_data 조회 속도 향상
CREATE INDEX IF NOT EXISTS idx_aed_data_equipment_serial
ON aed_data(equipment_serial);

-- ==========================================
-- 5. 컬럼 코멘트 추가 (문서화)
-- ==========================================

COMMENT ON COLUMN inspection_sessions.original_snapshot IS '세션 시작 시점의 등록 데이터 (불변)';
COMMENT ON COLUMN inspection_sessions.current_snapshot IS '갱신된 최신 등록 데이터 (가변)';
COMMENT ON COLUMN inspection_sessions.snapshot_updated_at IS '마지막 갱신 시간';
COMMENT ON COLUMN inspection_sessions.last_accessed_at IS '마지막 접근 시간 (갱신 정책 판단용)';
COMMENT ON COLUMN inspection_sessions.refresh_status IS '갱신 상태: idle, refreshing, success, failed';
COMMENT ON COLUMN inspection_sessions.refresh_error IS '갱신 실패 시 오류 메시지';
COMMENT ON COLUMN inspection_sessions.device_info IS '🔵 하위 호환성용 (Week 4에 제거 예정)';

-- ==========================================
-- 6. inspections 테이블 확장 (3단계 데이터 저장)
-- ==========================================

ALTER TABLE inspections
ADD COLUMN IF NOT EXISTS original_data JSONB,
ADD COLUMN IF NOT EXISTS registered_data JSONB,
ADD COLUMN IF NOT EXISTS inspected_data JSONB;

COMMENT ON COLUMN inspections.original_data IS '세션 시작 시점의 등록 데이터';
COMMENT ON COLUMN inspections.registered_data IS '점검 완료 시점의 등록 데이터';
COMMENT ON COLUMN inspections.inspected_data IS '점검자가 확인/수정한 데이터';

-- ==========================================
-- 7. 검증 및 로그
-- ==========================================

DO $$
DECLARE
  total_sessions INTEGER;
  migrated_sessions INTEGER;
  null_sessions INTEGER;
BEGIN
  -- 전체 세션 수
  SELECT COUNT(*) INTO total_sessions
  FROM inspection_sessions;

  -- 마이그레이션된 세션 수
  SELECT COUNT(*) INTO migrated_sessions
  FROM inspection_sessions
  WHERE original_snapshot IS NOT NULL;

  -- NULL 세션 수
  SELECT COUNT(*) INTO null_sessions
  FROM inspection_sessions
  WHERE original_snapshot IS NULL;

  -- 결과 출력
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration v2.1 Phase 1 완료';
  RAISE NOTICE '========================================';
  RAISE NOTICE '전체 세션: %', total_sessions;
  RAISE NOTICE '마이그레이션 완료: %', migrated_sessions;
  RAISE NOTICE '미처리 세션: %', null_sessions;
  RAISE NOTICE '========================================';

  -- 검증
  IF null_sessions > 0 THEN
    RAISE WARNING '% 개의 세션에 snapshot이 설정되지 않았습니다.', null_sessions;
  ELSE
    RAISE NOTICE '✅ 모든 세션 마이그레이션 성공';
  END IF;

  -- device_info 유지 확인
  SELECT COUNT(*) INTO total_sessions
  FROM information_schema.columns
  WHERE table_name = 'inspection_sessions'
    AND column_name = 'device_info';

  IF total_sessions = 1 THEN
    RAISE NOTICE '✅ device_info 컬럼 유지 (하위 호환성)';
  ELSE
    RAISE WARNING '⚠️ device_info 컬럼이 없습니다!';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- ==========================================
-- 참고: device_info는 아직 제거하지 않음
-- Week 2-3에 API와 프론트엔드에서 current_snapshot으로 전환
-- Week 4에 별도 마이그레이션(56_remove_device_info.sql)으로 제거
-- ==========================================
