-- ============================================
-- Migration 20: 점검 세션 관리 시스템
-- 실행일: 2025-09-26
-- 목적: 점검 세션 추적 및 진행 상태 관리
-- ============================================

-- ============================================
-- 1. inspection_sessions 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS public.inspection_sessions (
  -- Primary Key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- AED 장치 참조 (equipment_serial 기반)
  equipment_serial VARCHAR(255) NOT NULL,

  -- 점검자 정보
  inspector_id UUID NOT NULL REFERENCES user_profiles(id),

  -- 세션 상태
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled', 'paused')),

  -- 진행 상태
  current_step INTEGER DEFAULT 0 CHECK (current_step >= 0 AND current_step <= 7),
  step_data JSONB DEFAULT '{}',

  -- 타임스탬프
  started_at TIMESTAMPTZ DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- 메타데이터
  device_info JSONB, -- 세션 시작 시점의 장치 정보 스냅샷
  notes TEXT,

  -- 시스템 필드
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 인덱스 추가
-- ============================================

-- 장치별 세션 조회 최적화
CREATE INDEX idx_inspection_sessions_equipment
ON inspection_sessions(equipment_serial);

-- 점검자별 세션 조회 최적화
CREATE INDEX idx_inspection_sessions_inspector
ON inspection_sessions(inspector_id);

-- 상태별 조회 최적화
CREATE INDEX idx_inspection_sessions_status
ON inspection_sessions(status);

-- 최근 세션 조회 최적화
CREATE INDEX idx_inspection_sessions_created
ON inspection_sessions(created_at DESC);

-- 활성 세션 빠른 조회
CREATE INDEX idx_inspection_sessions_active
ON inspection_sessions(status, inspector_id)
WHERE status = 'active';

-- ============================================
-- 3. RLS 정책 설정
-- ============================================

ALTER TABLE inspection_sessions ENABLE ROW LEVEL SECURITY;

-- 점검자는 자신의 세션만 조회 가능
CREATE POLICY "inspectors_own_sessions_select" ON inspection_sessions
  FOR SELECT USING (
    inspector_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin')
    )
  );

-- 점검자는 자신의 세션만 생성 가능
CREATE POLICY "inspectors_own_sessions_insert" ON inspection_sessions
  FOR INSERT WITH CHECK (inspector_id = auth.uid());

-- 점검자는 자신의 활성 세션만 수정 가능
CREATE POLICY "inspectors_own_sessions_update" ON inspection_sessions
  FOR UPDATE USING (
    inspector_id = auth.uid()
    AND status IN ('active', 'paused')
  )
  WITH CHECK (inspector_id = auth.uid());

-- 관리자는 모든 세션 조회 가능
CREATE POLICY "admins_all_sessions_select" ON inspection_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('master', 'emergency_center_admin')
    )
  );

-- ============================================
-- 4. 트리거 함수: updated_at 자동 갱신
-- ============================================

CREATE OR REPLACE FUNCTION update_inspection_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inspection_sessions_updated_at
  BEFORE UPDATE ON inspection_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_inspection_sessions_updated_at();

-- ============================================
-- 5. 헬퍼 함수: 활성 세션 확인
-- ============================================

CREATE OR REPLACE FUNCTION get_active_session(
  p_inspector_id UUID
) RETURNS TABLE (
  session_id UUID,
  equipment_serial VARCHAR,
  current_step INTEGER,
  started_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id as session_id,
    inspection_sessions.equipment_serial,
    inspection_sessions.current_step,
    inspection_sessions.started_at
  FROM inspection_sessions
  WHERE inspector_id = p_inspector_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. 헬퍼 함수: 세션 완료 처리
-- ============================================

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
    -- 상태 매핑 (v2 스키마: good/warning/bad/not_checked)
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

-- ============================================
-- 7. 통계 뷰: 세션 현황
-- ============================================

CREATE OR REPLACE VIEW inspection_session_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_sessions,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_sessions,
  COUNT(*) FILTER (WHERE status = 'paused') as paused_sessions,
  COUNT(*) FILTER (WHERE completed_at > NOW() - INTERVAL '24 hours') as completed_today,
  COUNT(*) FILTER (WHERE started_at > NOW() - INTERVAL '7 days') as started_this_week
FROM inspection_sessions;

-- 권한 설정
GRANT SELECT ON inspection_session_stats TO authenticated;

-- ============================================
-- 8. 코멘트 추가
-- ============================================

COMMENT ON TABLE inspection_sessions IS '점검 세션 관리 테이블 - 점검 진행 상태 추적';
COMMENT ON COLUMN inspection_sessions.equipment_serial IS 'AED 장치 일련번호';
COMMENT ON COLUMN inspection_sessions.inspector_id IS '점검자 ID';
COMMENT ON COLUMN inspection_sessions.status IS '세션 상태: active(진행중), completed(완료), cancelled(취소), paused(일시정지)';
COMMENT ON COLUMN inspection_sessions.current_step IS '현재 진행 단계 (0-7)';
COMMENT ON COLUMN inspection_sessions.step_data IS '각 단계별 입력 데이터';
COMMENT ON COLUMN inspection_sessions.device_info IS '세션 시작 시점의 장치 정보 스냅샷';

-- ============================================
-- 마이그레이션 완료
-- ============================================