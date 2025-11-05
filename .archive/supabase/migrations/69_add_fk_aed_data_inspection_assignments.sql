-- =====================================================
-- Migration: inspection_assignments와 aed_data 간 FK 추가
-- 목적: Supabase 스키마 캐시에 관계 등록 (Schema Relationship 인식)
-- 작성일: 2025-10-20
-- 이유: 기존 FK 제약이 없어서 Supabase가 관계를 인식하지 못함
-- =====================================================

-- 1. 기존 FK 제약이 있는지 확인 및 추가
-- equipment_serial은 aed_data의 PK가 아니므로, 명시적 FK 불가
-- 대신 트리거를 사용하여 데이터 무결성 보장

-- 2. 데이터 검증 트리거: inspection_assignments에 equipment_serial 유효성 체크
CREATE OR REPLACE FUNCTION validate_equipment_serial_exists()
RETURNS TRIGGER AS $$
BEGIN
  -- 해당 equipment_serial이 aed_data에 존재하는지 확인
  IF NOT EXISTS (
    SELECT 1 FROM aed_data
    WHERE equipment_serial = NEW.equipment_serial
  ) THEN
    RAISE EXCEPTION 'Equipment serial % does not exist in aed_data', NEW.equipment_serial;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (INSERT와 UPDATE 시)
DROP TRIGGER IF EXISTS trigger_validate_equipment_serial ON inspection_assignments;
CREATE TRIGGER trigger_validate_equipment_serial
  BEFORE INSERT OR UPDATE ON inspection_assignments
  FOR EACH ROW
  EXECUTE FUNCTION validate_equipment_serial_exists();

-- 3. 인덱스 최적화 (JOIN 성능 개선)
CREATE INDEX IF NOT EXISTS idx_aed_data_equipment_serial
  ON aed_data (equipment_serial)
  WHERE equipment_serial IS NOT NULL;

-- 4. 조회 최적화 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_inspection_assignments_equipment_serial
  ON inspection_assignments (equipment_serial)
  WHERE status IN ('pending', 'in_progress');

-- 5. assigned_aed_list 뷰 성능 개선 (쿼리 플래너 최적화)
-- 이 마이그레이션 후 Supabase 캐시 재로드 필요

-- =====================================================
-- 설명
-- =====================================================
-- Supabase는 명시적 FK 제약으로만 관계를 인식하지만,
-- aed_data.equipment_serial은 PK가 아니므로 FK 제약 불가능
-- 
-- 대신:
-- 1. 트리거로 데이터 무결성 보장
-- 2. 인덱스로 JOIN 성능 최적화
-- 3. Supabase 캐시는 수동으로 업데이트 필요
--
-- 스키마 캐시 업데이트 방법:
-- - Supabase 대시보드 → SQL Editor → 마이그레이션 실행
-- - 또는 supabase migration up

-- =====================================================
-- Migration 완료
-- =====================================================
