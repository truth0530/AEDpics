-- ============================================
-- Migration 27: 영속성 매핑 테이블 및 점검 스키마 보완
-- 실행일: 2025-10-03
-- 목적: aed_data 교체에도 외부키 보존 + 점검 수정 이력 추적
-- ============================================

-- ============================================
-- 1. 영속성 매핑 테이블 (aed_persistent_mapping)
-- ============================================
-- 목적: aed_data가 매일 교체되어도 외부키 매핑 정보 보존

CREATE TABLE IF NOT EXISTS public.aed_persistent_mapping (
  -- 안정적 키 (equipment_serial)
  equipment_serial VARCHAR(255) PRIMARY KEY,

  -- 외부 시스템 고유키 (향후 추가될 데이터)
  external_system_id VARCHAR(255) UNIQUE,
  external_system_name VARCHAR(100), -- 예: 'e-gen', 'fire-department' 등

  -- 매칭 정보
  matched_by UUID REFERENCES user_profiles(id),
  matched_at TIMESTAMPTZ,
  matching_method VARCHAR(50) DEFAULT 'manual' CHECK (
    matching_method IN ('manual', 'auto', 'verified', 'pending')
  ),
  matching_confidence NUMERIC(5,2) CHECK (matching_confidence BETWEEN 0 AND 100),

  -- 매칭 메타데이터
  matching_notes TEXT,
  verified_by UUID REFERENCES user_profiles(id),
  verified_at TIMESTAMPTZ,

  -- 변경 이력 (외부키 변경 시)
  previous_external_id VARCHAR(255),
  change_history JSONB DEFAULT '[]',

  -- 시스템 필드
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_persistent_mapping_external_id
  ON aed_persistent_mapping(external_system_id);

CREATE INDEX idx_persistent_mapping_matched_by
  ON aed_persistent_mapping(matched_by);

CREATE INDEX idx_persistent_mapping_matching_status
  ON aed_persistent_mapping(matching_method, matched_at DESC);

-- 업데이트 트리거
CREATE TRIGGER update_persistent_mapping_updated_at
  BEFORE UPDATE ON public.aed_persistent_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 정책
ALTER TABLE aed_persistent_mapping ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자 조회 가능
CREATE POLICY "mapping_authenticated_read" ON aed_persistent_mapping
  FOR SELECT USING (auth.role() = 'authenticated');

-- 관리자만 수정 가능
CREATE POLICY "mapping_admin_write" ON aed_persistent_mapping
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin')
      AND user_profiles.is_active = true
    )
  );

COMMENT ON TABLE aed_persistent_mapping IS 'AED 장비 영속성 매핑 - equipment_serial과 외부 시스템 ID 연결';
COMMENT ON COLUMN aed_persistent_mapping.equipment_serial IS 'aed_data와 연결되는 안정적 키';
COMMENT ON COLUMN aed_persistent_mapping.external_system_id IS '외부 시스템 고유 ID (e-gen 등)';

-- ============================================
-- 2. aed_data 테이블에 외부키 컬럼 추가
-- ============================================
-- 매일 교체 시 persistent_mapping 테이블에서 자동 복원

ALTER TABLE aed_data
  ADD COLUMN IF NOT EXISTS external_system_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS external_sync_status VARCHAR(50) DEFAULT 'pending' CHECK (
    external_sync_status IN ('pending', 'matched', 'verified', 'conflict', 'unmatched')
  ),
  ADD COLUMN IF NOT EXISTS last_external_sync TIMESTAMPTZ;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_aed_data_external_id
  ON aed_data(external_system_id);

CREATE INDEX IF NOT EXISTS idx_aed_data_sync_status
  ON aed_data(external_sync_status);

COMMENT ON COLUMN aed_data.external_system_id IS '외부 시스템 ID (persistent_mapping에서 자동 복원)';
COMMENT ON COLUMN aed_data.external_sync_status IS '외부 시스템 매칭 상태';

-- ============================================
-- 3. aed_data 교체 시 외부키 자동 복원 함수
-- ============================================

CREATE OR REPLACE FUNCTION restore_external_mapping()
RETURNS TRIGGER AS $$
BEGIN
  -- aed_data에 새 레코드 삽입 시, persistent_mapping에서 외부키 복원
  SELECT
    external_system_id,
    'matched' as sync_status,
    NOW() as last_sync
  INTO
    NEW.external_system_id,
    NEW.external_sync_status,
    NEW.last_external_sync
  FROM aed_persistent_mapping
  WHERE equipment_serial = NEW.equipment_serial;

  -- 매핑 정보가 없으면 pending 상태 유지
  IF NOT FOUND THEN
    NEW.external_sync_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (aed_data INSERT 시 자동 실행)
DROP TRIGGER IF EXISTS trigger_restore_external_mapping ON aed_data;
CREATE TRIGGER trigger_restore_external_mapping
  BEFORE INSERT ON aed_data
  FOR EACH ROW
  EXECUTE FUNCTION restore_external_mapping();

-- ============================================
-- 4. aed_inspections 테이블 보완 (수정 이력 추적)
-- ============================================

ALTER TABLE aed_inspections
  -- 필드별 변경 이력 (JSONB)
  ADD COLUMN IF NOT EXISTS field_changes JSONB DEFAULT '{}',

  -- 원데이터 스냅샷 (세션 시작 시점 - device_info와 중복이지만 명시적)
  ADD COLUMN IF NOT EXISTS original_data JSONB,

  -- 총 변경 필드 수 (통계용)
  ADD COLUMN IF NOT EXISTS total_changes INTEGER DEFAULT 0,

  -- 점검 완료 여부 플래그
  ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT false,

  -- 보고서 생성 여부
  ADD COLUMN IF NOT EXISTS report_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_url TEXT,

  -- 외부 시스템 연동 (점검 시점의 external_system_id 보존)
  ADD COLUMN IF NOT EXISTS external_system_id_at_inspection VARCHAR(255);

-- 인덱스 추가 (보고서 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_inspections_finalized
  ON aed_inspections(is_finalized, inspection_date DESC);

CREATE INDEX IF NOT EXISTS idx_inspections_report_status
  ON aed_inspections(report_generated, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inspections_total_changes
  ON aed_inspections(total_changes DESC)
  WHERE total_changes > 0;

COMMENT ON COLUMN aed_inspections.field_changes IS '점검 시 수정된 필드 이력 (원본값, 수정값, 사유 포함)';
COMMENT ON COLUMN aed_inspections.original_data IS '점검 시작 시점의 aed_data 스냅샷';
COMMENT ON COLUMN aed_inspections.external_system_id_at_inspection IS '점검 시점의 외부 시스템 ID (aed_data 교체 대비)';

-- ============================================
-- 5. 트리거: total_changes 자동 계산
-- ============================================

CREATE OR REPLACE FUNCTION update_inspection_total_changes()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_changes := (
    SELECT COUNT(*)
    FROM jsonb_object_keys(NEW.field_changes)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_total_changes ON aed_inspections;
CREATE TRIGGER trigger_update_total_changes
  BEFORE INSERT OR UPDATE OF field_changes ON aed_inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_inspection_total_changes();

-- ============================================
-- 6. 뷰: 통합 장비 정보 (aed_data + persistent_mapping)
-- ============================================

CREATE OR REPLACE VIEW aed_integrated_view AS
SELECT
  a.*,
  -- 영속성 매핑 정보
  pm.external_system_id as persistent_external_id,
  pm.external_system_name,
  pm.matching_method,
  pm.matching_confidence,
  pm.matched_by,
  pm.matched_at,
  pm.verified_by,
  pm.verified_at,

  -- 매칭 상태 판단
  CASE
    WHEN pm.external_system_id IS NULL THEN 'unmatched'
    WHEN pm.verified_at IS NOT NULL THEN 'verified'
    WHEN pm.matched_at IS NOT NULL THEN 'matched'
    ELSE 'pending'
  END as overall_matching_status

FROM aed_data a
LEFT JOIN aed_persistent_mapping pm
  ON a.equipment_serial = pm.equipment_serial;

GRANT SELECT ON aed_integrated_view TO authenticated;

COMMENT ON VIEW aed_integrated_view IS 'aed_data + 영속성 매핑 정보 통합 뷰';

-- ============================================
-- 7. 뷰: 수정 이력 요약
-- ============================================

CREATE OR REPLACE VIEW inspection_change_summary AS
SELECT
  i.id as inspection_id,
  i.equipment_serial,
  i.inspection_date,
  i.inspector_name,
  i.total_changes,
  i.is_finalized,
  i.external_system_id_at_inspection,

  -- 변경된 필드 목록
  ARRAY(SELECT jsonb_object_keys(i.field_changes)) as changed_fields,

  -- 중요 필드 변경 여부 (배터리/패드/제조번호 등)
  EXISTS(
    SELECT 1
    FROM jsonb_object_keys(i.field_changes) field
    WHERE field IN (
      'management_number',
      'equipment_serial',
      'battery_expiry_date',
      'pad_expiry_date',
      'manufacturer',
      'model_name'
    )
  ) as has_critical_changes,

  -- 보고서 상태
  i.report_generated,
  i.report_url,

  -- 원본 데이터와 현재 aed_data 비교 (교체 감지)
  CASE
    WHEN i.original_data->>'id' != a.id::text THEN 'data_replaced'
    ELSE 'current'
  END as data_status

FROM aed_inspections i
LEFT JOIN aed_data a ON i.equipment_serial = a.equipment_serial
WHERE i.total_changes > 0;

GRANT SELECT ON inspection_change_summary TO authenticated;

COMMENT ON VIEW inspection_change_summary IS '점검 수정 이력 요약 뷰 (보고서 생성용)';

-- ============================================
-- 8. 함수: 외부 시스템 ID 매칭
-- ============================================

CREATE OR REPLACE FUNCTION match_external_system(
  p_equipment_serial VARCHAR,
  p_external_id VARCHAR,
  p_system_name VARCHAR,
  p_method VARCHAR DEFAULT 'manual',
  p_confidence NUMERIC DEFAULT 100.0,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_existing_record RECORD;
BEGIN
  -- 기존 매핑 확인
  SELECT * INTO v_existing_record
  FROM aed_persistent_mapping
  WHERE equipment_serial = p_equipment_serial;

  IF FOUND THEN
    -- 변경 이력 기록
    UPDATE aed_persistent_mapping
    SET
      previous_external_id = external_system_id,
      external_system_id = p_external_id,
      external_system_name = p_system_name,
      matching_method = p_method,
      matching_confidence = p_confidence,
      matching_notes = p_notes,
      matched_by = auth.uid(),
      matched_at = NOW(),
      change_history = change_history || jsonb_build_object(
        'timestamp', NOW(),
        'old_id', external_system_id,
        'new_id', p_external_id,
        'changed_by', auth.uid()
      )
    WHERE equipment_serial = p_equipment_serial;
  ELSE
    -- 새 매핑 생성
    INSERT INTO aed_persistent_mapping (
      equipment_serial,
      external_system_id,
      external_system_name,
      matching_method,
      matching_confidence,
      matching_notes,
      matched_by,
      matched_at
    ) VALUES (
      p_equipment_serial,
      p_external_id,
      p_system_name,
      p_method,
      p_confidence,
      p_notes,
      auth.uid(),
      NOW()
    );
  END IF;

  -- aed_data 테이블도 업데이트
  UPDATE aed_data
  SET
    external_system_id = p_external_id,
    external_sync_status = 'matched',
    last_external_sync = NOW()
  WHERE equipment_serial = p_equipment_serial;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION match_external_system IS '외부 시스템 ID 매칭 함수 (수작업/자동 모두 지원)';

-- ============================================
-- 9. 함수: 매핑 검증 승인
-- ============================================

CREATE OR REPLACE FUNCTION verify_external_mapping(
  p_equipment_serial VARCHAR,
  p_verified BOOLEAN DEFAULT TRUE
) RETURNS BOOLEAN AS $$
BEGIN
  IF p_verified THEN
    UPDATE aed_persistent_mapping
    SET
      matching_method = 'verified',
      verified_by = auth.uid(),
      verified_at = NOW()
    WHERE equipment_serial = p_equipment_serial;

    UPDATE aed_data
    SET external_sync_status = 'verified'
    WHERE equipment_serial = p_equipment_serial;
  ELSE
    UPDATE aed_persistent_mapping
    SET
      matching_method = 'pending',
      verified_by = NULL,
      verified_at = NULL
    WHERE equipment_serial = p_equipment_serial;

    UPDATE aed_data
    SET external_sync_status = 'pending'
    WHERE equipment_serial = p_equipment_serial;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_external_mapping IS '외부 시스템 매칭 검증 승인/취소';

-- ============================================
-- 10. 통계 뷰: 외부 시스템 매칭 현황
-- ============================================

CREATE OR REPLACE VIEW external_mapping_stats AS
SELECT
  COUNT(*) as total_devices,
  COUNT(pm.external_system_id) as matched_devices,
  COUNT(pm.verified_at) as verified_devices,
  COUNT(*) FILTER (WHERE a.external_sync_status = 'pending') as pending_devices,
  COUNT(*) FILTER (WHERE a.external_sync_status = 'conflict') as conflict_devices,

  ROUND(
    100.0 * COUNT(pm.external_system_id) / NULLIF(COUNT(*), 0),
    2
  ) as matching_rate,

  ROUND(
    100.0 * COUNT(pm.verified_at) / NULLIF(COUNT(*), 0),
    2
  ) as verification_rate

FROM aed_data a
LEFT JOIN aed_persistent_mapping pm ON a.equipment_serial = pm.equipment_serial;

GRANT SELECT ON external_mapping_stats TO authenticated;

COMMENT ON VIEW external_mapping_stats IS '외부 시스템 매칭 통계';

-- ============================================
-- 11. 마이그레이션 완료 로그
-- ============================================

INSERT INTO public.schema_migrations (version, applied_at)
VALUES ('27_persistent_mapping_table', NOW())
ON CONFLICT (version) DO NOTHING;
