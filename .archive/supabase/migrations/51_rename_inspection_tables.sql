-- =====================================================
-- Migration 51: Inspection 테이블 네이밍 통일
-- 목적: aed_ 접두어 제거하여 네이밍 일관성 확보
-- 작성일: 2025-10-05
-- =====================================================

-- 안전성: ALTER TABLE/VIEW RENAME은 FK, 트리거, 인덱스를 자동으로 유지함

-- 1. 뷰 이름 변경 (의존성이 적으므로 먼저 수행)
DO $$
BEGIN
  -- aed_inspection_status → inspection_status
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
    AND viewname = 'aed_inspection_status'
  ) THEN
    ALTER VIEW aed_inspection_status RENAME TO inspection_status;
    RAISE NOTICE 'Renamed view: aed_inspection_status → inspection_status';
  ELSE
    RAISE NOTICE 'View aed_inspection_status does not exist, skipping';
  END IF;
END $$;

-- 2. 테이블 이름 변경
DO $$
BEGIN
  -- aed_inspections_v2 → inspections
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'aed_inspections_v2'
  ) THEN
    ALTER TABLE aed_inspections_v2 RENAME TO inspections;
    RAISE NOTICE 'Renamed table: aed_inspections_v2 → inspections';
  ELSE
    RAISE NOTICE 'Table aed_inspections_v2 does not exist, skipping';
  END IF;
END $$;

-- 3. 검증 쿼리 (주석으로 제공, 필요시 수동 실행)
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%inspection%' ORDER BY tablename;
-- SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE '%inspection%' ORDER BY viewname;

-- 4. 롤백 가이드 (문제 발생 시)
-- ALTER TABLE inspections RENAME TO aed_inspections_v2;
-- ALTER VIEW inspection_status RENAME TO aed_inspection_status;

-- =====================================================
-- Migration 완료
-- =====================================================
