-- =====================================================
-- Migration 53: complete_inspection_session RPC 함수 재생성
-- 목적: inspections 테이블 이름 변경에 맞춰 RPC 함수 재생성
-- 작성일: 2025-10-05
-- =====================================================

-- 주의: Migration 51에서 aed_inspections_v2 → inspections로 이름 변경됨

-- 세션 완료 처리 함수 재생성
CREATE OR REPLACE FUNCTION complete_inspection_session(
  p_session_id UUID,
  p_final_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_session inspection_sessions%ROWTYPE;
  v_inspection_id UUID;
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
    inspection_longitude
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
    (p_final_data->'location'->>'longitude')::numeric(11,8)
  )
  RETURNING id INTO v_inspection_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 권한 설정
GRANT EXECUTE ON FUNCTION complete_inspection_session(UUID, JSONB) TO authenticated;

-- 코멘트
COMMENT ON FUNCTION complete_inspection_session IS '점검 세션 완료 및 inspections 테이블에 최종 결과 저장';

-- =====================================================
-- Migration 완료
-- =====================================================
