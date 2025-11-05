-- Bulk Create Assignments RPC Function
-- 원자적 트랜잭션으로 대량 일정추가 처리
-- 부분 성공 없이 all-or-nothing 보장

CREATE OR REPLACE FUNCTION bulk_create_assignments(
  p_equipment_serials TEXT[],
  p_assigned_to UUID,
  p_assigned_by UUID,
  p_assignment_type TEXT DEFAULT 'scheduled',
  p_scheduled_date DATE DEFAULT NULL,
  p_scheduled_time TIME DEFAULT NULL,
  p_priority_level INT DEFAULT 0,
  p_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_created_count INT := 0;
  v_skipped_count INT := 0;
  v_existing_serials TEXT[];
  v_new_serials TEXT[];
  v_result JSON;
BEGIN
  -- 1. 기존에 할당된 장비 찾기 (pending, in_progress 상태만)
  SELECT ARRAY_AGG(equipment_serial)
  INTO v_existing_serials
  FROM inspection_assignments
  WHERE equipment_serial = ANY(p_equipment_serials)
    AND assigned_to = p_assigned_to
    AND status IN ('pending', 'in_progress');

  -- NULL 처리
  v_existing_serials := COALESCE(v_existing_serials, ARRAY[]::TEXT[]);
  v_skipped_count := ARRAY_LENGTH(v_existing_serials, 1);
  v_skipped_count := COALESCE(v_skipped_count, 0);

  -- 2. 새로운 장비만 필터링
  SELECT ARRAY_AGG(serial)
  INTO v_new_serials
  FROM UNNEST(p_equipment_serials) AS serial
  WHERE serial != ALL(v_existing_serials);

  -- NULL 처리
  v_new_serials := COALESCE(v_new_serials, ARRAY[]::TEXT[]);

  -- 3. 새로운 장비가 없으면 스킵
  IF ARRAY_LENGTH(v_new_serials, 1) IS NULL OR ARRAY_LENGTH(v_new_serials, 1) = 0 THEN
    RETURN json_build_object(
      'success', false,
      'created', 0,
      'skipped', v_skipped_count,
      'total', ARRAY_LENGTH(p_equipment_serials, 1),
      'message', '모든 장비가 이미 할당되어 있습니다.'
    );
  END IF;

  -- 4. 대량 삽입 (원자적 트랜잭션)
  -- ON CONFLICT 제거: 이미 v_new_serials로 중복 필터링 완료
  INSERT INTO inspection_assignments (
    equipment_serial,
    assigned_to,
    assigned_by,
    assignment_type,
    scheduled_date,
    scheduled_time,
    priority_level,
    notes,
    status
  )
  SELECT
    serial,
    p_assigned_to,
    p_assigned_by,
    p_assignment_type,
    p_scheduled_date,
    p_scheduled_time,
    p_priority_level,
    p_notes,
    'pending'
  FROM UNNEST(v_new_serials) AS serial;

  -- 5. 생성된 개수 확인
  GET DIAGNOSTICS v_created_count = ROW_COUNT;

  -- 6. 결과 반환
  RETURN json_build_object(
    'success', true,
    'created', v_created_count,
    'skipped', v_skipped_count,
    'total', ARRAY_LENGTH(p_equipment_serials, 1),
    'message', v_created_count || '개 장비의 일정추가가 완료되었습니다.'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- 오류 발생 시 전체 롤백
    RAISE EXCEPTION '일정추가 실패: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION bulk_create_assignments TO authenticated;

-- 코멘트 추가
COMMENT ON FUNCTION bulk_create_assignments IS '대량 일정추가를 원자적 트랜잭션으로 처리. 부분 성공 없이 all-or-nothing 보장.';
