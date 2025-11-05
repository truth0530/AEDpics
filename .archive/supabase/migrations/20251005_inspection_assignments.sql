-- =====================================================
-- Migration: inspection_assignments 테이블 생성
-- 목적: 점검 일정추가 및 할당 관리
-- 작성일: 2025-10-05
-- =====================================================

-- 0. 필수 확장 활성화 (EXCLUDE 제약조건용)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. inspection_assignments 테이블 생성
CREATE TABLE IF NOT EXISTS inspection_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 할당 대상 AED (FK 제약조건 없음 - equipment_serial은 PK가 아님)
  equipment_serial VARCHAR(255) NOT NULL,

  -- 할당 정보 (user_profiles 테이블 참조)
  assigned_to UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- 할당 타입
  assignment_type TEXT NOT NULL DEFAULT 'scheduled' CHECK (assignment_type IN ('scheduled', 'urgent', 'follow_up')),

  -- 일정 정보
  scheduled_date DATE,
  scheduled_time TIME,

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

  -- 우선순위
  priority_level INT DEFAULT 0 CHECK (priority_level BETWEEN 0 AND 3),

  -- 메모
  notes TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- 중복 방지 제약조건 (동일 장비 + 동일 점검원 + active 상태)
  CONSTRAINT unique_active_assignment
    EXCLUDE USING gist (
      equipment_serial WITH =,
      assigned_to WITH =
    )
    WHERE (status IN ('pending', 'in_progress'))
);

-- 2. 인덱스 생성
CREATE INDEX idx_assignments_assigned_to_status
  ON inspection_assignments (assigned_to, status, scheduled_date DESC)
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX idx_assignments_equipment_status
  ON inspection_assignments (equipment_serial, status, created_at DESC);

CREATE INDEX idx_assignments_scheduled_date
  ON inspection_assignments (scheduled_date DESC, status)
  WHERE status = 'pending';

CREATE INDEX idx_assignments_assigned_by
  ON inspection_assignments (assigned_by, created_at DESC);

-- 3. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_inspection_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inspection_assignments_updated_at
  BEFORE UPDATE ON inspection_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_inspection_assignments_updated_at();

-- 4. 상태 변경 시 타임스탬프 자동 설정 트리거
CREATE OR REPLACE FUNCTION update_assignment_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- in_progress로 변경 시 started_at 설정
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    NEW.started_at = NOW();
  END IF;

  -- completed로 변경 시 completed_at 설정
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;

  -- cancelled로 변경 시 cancelled_at 설정
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assignment_status_timestamps
  BEFORE UPDATE ON inspection_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_status_timestamps();

-- 5. RLS (Row Level Security) 정책
ALTER TABLE inspection_assignments ENABLE ROW LEVEL SECURITY;

-- 본인에게 할당된 기록 조회 가능
CREATE POLICY "assignments_view_own" ON inspection_assignments
  FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR assigned_by = auth.uid()
  );

-- 본인이 생성한 기록만 수정 가능 (보건소 담당자)
CREATE POLICY "assignments_update_own" ON inspection_assignments
  FOR UPDATE
  USING (assigned_by = auth.uid());

-- 본인이 생성한 기록만 삭제 가능
CREATE POLICY "assignments_delete_own" ON inspection_assignments
  FOR DELETE
  USING (assigned_by = auth.uid());

-- 새 할당 생성 권한 (보건소 담당자 이상)
CREATE POLICY "assignments_insert_authorized" ON inspection_assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin')
    )
  );

-- 관리자는 모든 할당 조회 가능
CREATE POLICY "assignments_admin_view_all" ON inspection_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin')
    )
  );

-- 6. 뷰 생성: assigned_aed_list (현장점검 목록용)
-- 목적: 할당된 AED와 점검 완료 현황을 실시간 모니터링
CREATE OR REPLACE VIEW assigned_aed_list AS
SELECT
  a.*,  -- 모든 aed_data 필드

  -- 할당 정보
  ia.id AS assignment_id,
  ia.assigned_to,
  ia.assigned_by,
  ia.assignment_type,
  ia.scheduled_date,
  ia.scheduled_time,
  ia.status AS assignment_status,
  ia.priority_level AS assignment_priority,
  ia.notes AS assignment_notes,
  ia.created_at AS assigned_at,
  ia.started_at AS inspection_started_at,

  -- 할당자 정보
  up_assigned_by.full_name AS assigned_by_name,
  up_assigned_by.organization_id AS assigned_by_org,

  -- 할당받은 사람 정보
  up_assigned_to.full_name AS assigned_to_name,
  up_assigned_to.organization_id AS assigned_to_org,

  -- 점검 완료 정보 (inspection_sessions 참조)
  latest_session.session_id AS latest_session_id,
  latest_session.started_at AS session_started_at,
  latest_session.completed_at AS session_completed_at,
  latest_session.current_step AS session_current_step,
  latest_session.overall_status AS session_status,

  -- 점검 긴급도 계산
  CASE
    -- 이미 완료된 경우
    WHEN latest_session.completed_at IS NOT NULL THEN 'session_completed'
    -- 할당이 완료 상태인 경우
    WHEN ia.status = 'completed' THEN 'completed'
    -- 점검 진행 중인 경우
    WHEN latest_session.session_id IS NOT NULL AND latest_session.completed_at IS NULL THEN 'in_progress'
    -- 할당이 취소된 경우
    WHEN ia.status = 'cancelled' THEN 'cancelled'
    -- 일정 지연
    WHEN ia.scheduled_date < CURRENT_DATE THEN 'overdue'
    -- 오늘 점검 예정
    WHEN ia.scheduled_date = CURRENT_DATE THEN 'today'
    -- 7일 이내 예정
    WHEN ia.scheduled_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'upcoming'
    ELSE 'scheduled'
  END AS inspection_urgency,

  -- 지연 일수 (overdue인 경우)
  CASE
    WHEN ia.scheduled_date < CURRENT_DATE THEN CURRENT_DATE - ia.scheduled_date
    ELSE 0
  END AS days_overdue

FROM aed_data a
INNER JOIN inspection_assignments ia ON a.equipment_serial = ia.equipment_serial
LEFT JOIN user_profiles up_assigned_by ON ia.assigned_by = up_assigned_by.id
LEFT JOIN user_profiles up_assigned_to ON ia.assigned_to = up_assigned_to.id
LEFT JOIN LATERAL (
  SELECT
    id AS session_id,
    equipment_serial,
    started_at,
    completed_at,
    current_step,
    overall_status
  FROM inspection_sessions
  WHERE equipment_serial = a.equipment_serial
    AND inspector_id = ia.assigned_to
  ORDER BY started_at DESC
  LIMIT 1
) latest_session ON true

WHERE ia.status IN ('pending', 'in_progress', 'completed');

-- 7. 뷰 권한 설정
GRANT SELECT ON assigned_aed_list TO authenticated;

-- 8. 코멘트 추가
COMMENT ON TABLE inspection_assignments IS '점검 일정추가 및 할당 관리 테이블';
COMMENT ON COLUMN inspection_assignments.equipment_serial IS 'AED 장비 시리얼 번호 (aed_data.equipment_serial 참조)';
COMMENT ON COLUMN inspection_assignments.assigned_to IS '할당받은 점검원 (user_profiles.id)';
COMMENT ON COLUMN inspection_assignments.assigned_by IS '할당한 담당자 (user_profiles.id)';
COMMENT ON COLUMN inspection_assignments.assignment_type IS '할당 타입: scheduled(일반), urgent(긴급), follow_up(재점검)';
COMMENT ON COLUMN inspection_assignments.status IS '상태: pending(대기), in_progress(진행중), completed(완료), cancelled(취소)';
COMMENT ON COLUMN inspection_assignments.priority_level IS '우선순위: 0(보통), 1(높음), 2(긴급), 3(위험)';

-- =====================================================
-- Migration 완료
-- =====================================================
