-- =====================================================
-- Migration 56: 점검 완료 시 3단계 데이터 저장 추가
-- 목적: original_data, registered_data, inspected_data 저장
-- 작성일: 2025-10-09
-- =====================================================

-- 세션 완료 처리 함수 업데이트 (3단계 데이터 추가)
CREATE OR REPLACE FUNCTION complete_inspection_session(
  p_session_id UUID,
  p_final_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_session inspection_sessions%ROWTYPE;
  v_inspection_id UUID;
  v_latest_aed_data JSONB;
BEGIN
  -- 보안 강화: search_path 명시
  SET search_path = public;

  -- 세션 정보 조회
  SELECT * INTO v_session
  FROM inspection_sessions
  WHERE id = p_session_id
    AND status = 'active'
    AND inspector_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active session not found or unauthorized';
  END IF;

  -- 🆕 완료 시점의 최신 aed_data 조회
  SELECT to_jsonb(a.*) INTO v_latest_aed_data
  FROM aed_data a
  WHERE a.equipment_serial = v_session.equipment_serial
  LIMIT 1;

  -- 세션 완료 처리
  UPDATE inspection_sessions
  SET
    status = 'completed',
    completed_at = NOW(),
    step_data = p_final_data,
    current_step = 7
  WHERE id = p_session_id;

  -- inspections 테이블에 최종 결과 저장
  INSERT INTO inspections (
    aed_data_id,
    equipment_serial,
    inspector_id,
    inspection_date,
    inspection_type,
    visual_status,
    battery_status,
    pad_status,
    operation_status,
    overall_status,
    notes,
    issues_found,
    photos,
    inspection_latitude,
    inspection_longitude,
    -- 🆕 3단계 데이터 추가
    original_data,
    registered_data,
    inspected_data
  ) VALUES (
    -- aed_data_id 조회 (equipment_serial로)
    (SELECT id FROM aed_data WHERE equipment_serial = v_session.equipment_serial LIMIT 1),
    v_session.equipment_serial,
    v_session.inspector_id,
    NOW(),
    COALESCE(p_final_data->>'inspection_type', 'regular'),
    -- 상태 매핑 (스키마: good/warning/bad/not_checked)
    COALESCE(p_final_data->'deviceInfo'->>'visual_status', 'not_checked'),
    COALESCE(p_final_data->'supplies'->>'battery_status', 'not_checked'),
    COALESCE(p_final_data->'supplies'->>'pad_status', 'not_checked'),
    COALESCE(p_final_data->'deviceInfo'->>'operation_status', 'operational'),
    COALESCE(p_final_data->'validation'->>'overall_status', 'pending'),
    p_final_data->'documentation'->>'notes',
    -- issues_found (TEXT[] 배열)
    CASE
      WHEN p_final_data->'validation'->'issues' IS NOT NULL THEN
        ARRAY(SELECT jsonb_array_elements_text(p_final_data->'validation'->'issues'))
      ELSE
        NULL
    END,
    -- photos (TEXT[] 배열)
    CASE
      WHEN p_final_data->'documentation'->'photos' IS NOT NULL THEN
        ARRAY(SELECT jsonb_array_elements_text(p_final_data->'documentation'->'photos'))
      ELSE
        NULL
    END,
    -- GPS 좌표
    (p_final_data->'location'->>'latitude')::numeric(10,8),
    (p_final_data->'location'->>'longitude')::numeric(11,8),
    -- 🆕 3단계 데이터 저장
    v_session.original_snapshot,    -- 시작 시점 등록 데이터 (불변)
    v_latest_aed_data,               -- 완료 시점 최신 등록 데이터
    v_session.step_data              -- 점검자가 입력/수정한 데이터
  )
  RETURNING id INTO v_inspection_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 권한은 이미 설정되어 있으므로 생략

-- 코멘트
COMMENT ON FUNCTION complete_inspection_session IS '점검 세션 완료 및 inspections 테이블에 3단계 데이터 포함 저장 (v2.1)';

-- =====================================================
-- 검증
-- =====================================================

-- 기존 inspections 데이터 확인
DO $$
DECLARE
  total_inspections INTEGER;
  with_3tier_data INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_inspections FROM inspections;

  SELECT COUNT(*) INTO with_3tier_data
  FROM inspections
  WHERE original_data IS NOT NULL
    AND registered_data IS NOT NULL
    AND inspected_data IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 56 완료: 3단계 데이터 저장 추가';
  RAISE NOTICE '========================================';
  RAISE NOTICE '전체 점검 기록: %', total_inspections;
  RAISE NOTICE '3단계 데이터 포함: %', with_3tier_data;
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ 앞으로 생성되는 점검 기록은 3단계 데이터 포함';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- Migration 완료
-- =====================================================
