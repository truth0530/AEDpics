-- =====================================================
-- Migration 54: aed_inspection_schedules 테이블명 변경
-- 목적: aed_ 접두어 제거하여 네이밍 일관성 확보
-- 작성일: 2025-10-05
-- =====================================================

-- 안전성: ALTER TABLE RENAME은 FK, 트리거, 인덱스를 자동으로 유지함

DO $$
BEGIN
  -- aed_inspection_schedules → inspection_schedules
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'aed_inspection_schedules'
  ) THEN
    ALTER TABLE aed_inspection_schedules RENAME TO inspection_schedules;
    RAISE NOTICE 'Renamed table: aed_inspection_schedules → inspection_schedules';
  ELSE
    RAISE NOTICE 'Table aed_inspection_schedules does not exist, skipping';
  END IF;
END $$;

-- 검증 쿼리 (주석으로 제공)
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%schedule%' ORDER BY tablename;

-- 롤백 가이드 (문제 발생 시)
-- ALTER TABLE inspection_schedules RENAME TO aed_inspection_schedules;

-- =====================================================
-- Migration 완료
-- =====================================================
