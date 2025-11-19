-- TNMS 기반 자동 매칭 결과 테이블
-- target_list_2025와 aed_data의 최적 매칭을 저장
-- 동적 업데이트를 위한 뷰와 함수 포함

-- 1. 매칭 결과 테이블 생성
CREATE TABLE IF NOT EXISTS aedpics.tnms_matching_results (
  id SERIAL PRIMARY KEY,

  -- Target 정보 (고정)
  target_key VARCHAR(255) NOT NULL,
  target_institution_name VARCHAR(500),
  target_sido VARCHAR(100),
  target_gugun VARCHAR(100),
  target_address TEXT,
  target_normalized_name VARCHAR(500), -- TNMS 정규화된 이름

  -- 매칭된 AED 정보 (동적)
  matched_management_number VARCHAR(255),
  matched_equipment_serial VARCHAR(255),
  matched_institution_name VARCHAR(500),
  matched_address TEXT,
  matched_normalized_name VARCHAR(500), -- TNMS 정규화된 이름

  -- 매칭 메타데이터
  confidence_score NUMERIC(5,2), -- 0-100
  name_confidence NUMERIC(5,2),
  address_confidence NUMERIC(5,2),
  matching_rules TEXT[], -- 적용된 규칙 목록
  match_type VARCHAR(50), -- 'auto', 'manual', 'verified'

  -- 시스템 필드
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255),

  -- 인덱스를 위한 제약조건
  CONSTRAINT uk_target_key UNIQUE (target_key)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tnms_target_key ON aedpics.tnms_matching_results(target_key);
CREATE INDEX IF NOT EXISTS idx_tnms_equipment_serial ON aedpics.tnms_matching_results(matched_equipment_serial);
CREATE INDEX IF NOT EXISTS idx_tnms_management_number ON aedpics.tnms_matching_results(matched_management_number);
CREATE INDEX IF NOT EXISTS idx_tnms_confidence ON aedpics.tnms_matching_results(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_tnms_match_type ON aedpics.tnms_matching_results(match_type);

-- 3. 동적 업데이트를 위한 뷰 (항상 최신 aed_data 참조)
CREATE OR REPLACE VIEW aedpics.tnms_matching_current AS
SELECT
  tmr.id,
  tmr.target_key,
  tmr.target_institution_name,
  tmr.target_sido,
  tmr.target_gugun,
  tmr.target_address,

  -- AED 데이터는 equipment_serial을 통해 최신 정보 조인
  COALESCE(ad.management_number, tmr.matched_management_number) as current_management_number,
  tmr.matched_equipment_serial,
  COALESCE(ad.installation_institution, tmr.matched_institution_name) as current_institution_name,
  COALESCE(
    COALESCE(ad.installation_address, ad.installation_position),
    tmr.matched_address
  ) as current_address,

  tmr.confidence_score,
  tmr.name_confidence,
  tmr.address_confidence,
  tmr.matching_rules,
  tmr.match_type,

  -- 변경 감지
  CASE
    WHEN ad.management_number != tmr.matched_management_number THEN true
    WHEN ad.installation_institution != tmr.matched_institution_name THEN true
    ELSE false
  END as data_changed,

  tmr.created_at,
  tmr.updated_at
FROM aedpics.tnms_matching_results tmr
LEFT JOIN aedpics.aed_data ad ON tmr.matched_equipment_serial = ad.equipment_serial;

-- 4. 매칭 결과 업데이트 트리거 (AED 데이터 변경 시)
CREATE OR REPLACE FUNCTION aedpics.update_tnms_matching_on_aed_change()
RETURNS TRIGGER AS $$
BEGIN
  -- equipment_serial이 매칭된 경우 업데이트
  UPDATE aedpics.tnms_matching_results
  SET
    matched_management_number = NEW.management_number,
    matched_institution_name = NEW.installation_institution,
    matched_address = COALESCE(NEW.installation_address, NEW.installation_position),
    updated_at = NOW(),
    updated_by = 'aed_data_trigger'
  WHERE matched_equipment_serial = NEW.equipment_serial;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trg_update_tnms_matching ON aedpics.aed_data;
CREATE TRIGGER trg_update_tnms_matching
AFTER UPDATE ON aedpics.aed_data
FOR EACH ROW
WHEN (
  OLD.management_number IS DISTINCT FROM NEW.management_number OR
  OLD.installation_institution IS DISTINCT FROM NEW.installation_institution OR
  OLD.installation_address IS DISTINCT FROM NEW.installation_address
)
EXECUTE FUNCTION aedpics.update_tnms_matching_on_aed_change();

-- 5. 통계 뷰
CREATE OR REPLACE VIEW aedpics.tnms_matching_stats AS
SELECT
  COUNT(*) as total_targets,
  COUNT(matched_equipment_serial) as matched_count,
  COUNT(*) FILTER (WHERE matched_equipment_serial IS NULL) as unmatched_count,
  ROUND(AVG(confidence_score), 2) as avg_confidence,
  COUNT(*) FILTER (WHERE confidence_score >= 90) as high_confidence_count,
  COUNT(*) FILTER (WHERE confidence_score >= 70 AND confidence_score < 90) as medium_confidence_count,
  COUNT(*) FILTER (WHERE confidence_score < 70) as low_confidence_count,
  COUNT(*) FILTER (WHERE match_type = 'auto') as auto_matched,
  COUNT(*) FILTER (WHERE match_type = 'manual') as manual_matched,
  COUNT(*) FILTER (WHERE match_type = 'verified') as verified_matched
FROM aedpics.tnms_matching_results;

-- 6. 권한 설정
GRANT SELECT, INSERT, UPDATE ON aedpics.tnms_matching_results TO aedpics_admin;
GRANT SELECT ON aedpics.tnms_matching_current TO aedpics_admin;
GRANT SELECT ON aedpics.tnms_matching_stats TO aedpics_admin;

COMMENT ON TABLE aedpics.tnms_matching_results IS 'TNMS 기반 target_list_2025와 aed_data 자동 매칭 결과';
COMMENT ON VIEW aedpics.tnms_matching_current IS 'equipment_serial 기반 최신 AED 데이터가 반영된 매칭 뷰';
COMMENT ON VIEW aedpics.tnms_matching_stats IS 'TNMS 매칭 통계 대시보드용 뷰';