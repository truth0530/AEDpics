-- ============================================
-- Migration 05: 팀 관리 및 업무 할당 시스템
-- 실행일: 2025-09-11
-- 목적: 보건소 내 팀원 관리, 업무 할당, 스케줄 관리
-- ============================================

-- ============================================
-- 1. Team Members 테이블 (팀 구성원 관리)
-- ============================================
-- 기존 user_profiles와 별도로 관리되는 팀원 정보
-- korea.kr이 아닌 임시 점검원도 포함
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- 팀원 기본 정보
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    position TEXT, -- 직책/역할
    member_type TEXT NOT NULL CHECK (member_type IN ('permanent', 'temporary', 'volunteer')),
    
    -- 계정 연결 (선택사항 - user_profiles에 계정이 있는 경우)
    user_profile_id UUID REFERENCES user_profiles(id),
    
    -- 관리 정보
    added_by UUID NOT NULL REFERENCES user_profiles(id), -- 누가 추가했는지
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    
    -- 임시 점검원 정보
    temporary_period_start DATE,
    temporary_period_end DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Team Permissions 테이블 (팀원 권한 관리)
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    
    -- 세분화된 권한
    can_view_team_members BOOLEAN DEFAULT false,
    can_manage_team_members BOOLEAN DEFAULT false,
    can_assign_tasks BOOLEAN DEFAULT false,
    can_view_all_tasks BOOLEAN DEFAULT false,
    can_manage_schedules BOOLEAN DEFAULT false,
    can_perform_inspections BOOLEAN DEFAULT true,
    can_view_reports BOOLEAN DEFAULT false,
    can_export_data BOOLEAN DEFAULT false,
    
    -- 접근 가능한 AED 범위
    access_scope TEXT CHECK (access_scope IN ('all', 'assigned_only', 'department', 'custom')),
    custom_access_list TEXT[], -- AED ID 목록 (custom인 경우)
    
    granted_by UUID NOT NULL REFERENCES user_profiles(id),
    granted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Task Assignments 테이블 (업무 할당)
-- ============================================
CREATE TABLE IF NOT EXISTS public.task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- 업무 정보
    task_type TEXT NOT NULL CHECK (task_type IN ('inspection', 'maintenance', 'training', 'report', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    
    -- 할당 정보
    assigned_to UUID REFERENCES team_members(id),
    assigned_by UUID NOT NULL REFERENCES user_profiles(id),
    
    -- AED 연결 (점검/유지보수인 경우)
    aed_device_id UUID REFERENCES aed_devices(id),
    
    -- 일정
    scheduled_date DATE,
    scheduled_time TIME,
    deadline TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- 추가 정보
    notes TEXT,
    attachments JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Inspection Schedules 테이블 (점검 일정)
-- ============================================
CREATE TABLE IF NOT EXISTS public.inspection_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- 일정 정보
    schedule_type TEXT CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom')),
    title TEXT NOT NULL,
    description TEXT,
    
    -- 반복 설정
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB, -- {frequency: 'monthly', day: 15, ...}
    
    -- 담당자
    primary_inspector UUID REFERENCES team_members(id),
    backup_inspector UUID REFERENCES team_members(id),
    
    -- AED 그룹
    aed_group_criteria JSONB, -- {location: 'building_a', floor: 3, ...}
    aed_device_ids UUID[], -- 특정 AED 목록
    
    -- 일정 기간
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- 알림 설정
    reminder_days_before INTEGER DEFAULT 3,
    
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. Schedule Instances 테이블 (실제 생성된 일정)
-- ============================================
CREATE TABLE IF NOT EXISTS public.schedule_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES inspection_schedules(id) ON DELETE CASCADE,
    
    -- 실제 일정
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    
    -- 담당자
    assigned_inspector UUID REFERENCES team_members(id),
    
    -- 상태
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'missed', 'rescheduled')),
    
    -- 실행 정보
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    inspection_id UUID REFERENCES inspections(id), -- 실제 점검 기록 연결
    
    -- 변경 사항
    rescheduled_to DATE,
    rescheduled_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. Team Activity Logs 테이블 (팀 활동 기록)
-- ============================================
CREATE TABLE IF NOT EXISTS public.team_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- 활동 정보
    activity_type TEXT NOT NULL,
    activity_description TEXT NOT NULL,
    
    -- 관련 정보
    performed_by UUID REFERENCES user_profiles(id),
    team_member_id UUID REFERENCES team_members(id),
    task_id UUID REFERENCES task_assignments(id),
    schedule_id UUID REFERENCES inspection_schedules(id),
    
    -- 메타데이터
    metadata JSONB,
    ip_address INET,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. 인덱스 생성
-- ============================================
CREATE INDEX idx_team_members_organization ON team_members(organization_id);
CREATE INDEX idx_team_members_user_profile ON team_members(user_profile_id);
CREATE INDEX idx_team_members_active ON team_members(is_active);

CREATE INDEX idx_task_assignments_organization ON task_assignments(organization_id);
CREATE INDEX idx_task_assignments_assigned_to ON task_assignments(assigned_to);
CREATE INDEX idx_task_assignments_status ON task_assignments(status);
CREATE INDEX idx_task_assignments_scheduled_date ON task_assignments(scheduled_date);

CREATE INDEX idx_inspection_schedules_organization ON inspection_schedules(organization_id);
CREATE INDEX idx_inspection_schedules_primary_inspector ON inspection_schedules(primary_inspector);
CREATE INDEX idx_inspection_schedules_active ON inspection_schedules(is_active);

CREATE INDEX idx_schedule_instances_schedule ON schedule_instances(schedule_id);
CREATE INDEX idx_schedule_instances_date ON schedule_instances(scheduled_date);
CREATE INDEX idx_schedule_instances_status ON schedule_instances(status);

CREATE INDEX idx_team_activity_logs_organization ON team_activity_logs(organization_id);
CREATE INDEX idx_team_activity_logs_performed_by ON team_activity_logs(performed_by);
CREATE INDEX idx_team_activity_logs_created_at ON team_activity_logs(created_at);

-- ============================================
-- 8. 트리거 적용
-- ============================================
CREATE TRIGGER update_team_members_updated_at 
    BEFORE UPDATE ON public.team_members 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_assignments_updated_at 
    BEFORE UPDATE ON public.task_assignments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inspection_schedules_updated_at 
    BEFORE UPDATE ON public.inspection_schedules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedule_instances_updated_at 
    BEFORE UPDATE ON public.schedule_instances 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. RLS 정책 설정
-- ============================================

-- Team Members RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 조직 관리자는 자신의 조직 팀원을 볼 수 있음
CREATE POLICY team_members_view_policy ON team_members
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('local_admin', 'regional_admin', 'emergency_center_admin', 'master')
        )
    );

-- 조직 관리자는 팀원을 추가/수정할 수 있음
CREATE POLICY team_members_manage_policy ON team_members
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('local_admin', 'regional_admin')
        )
    );

-- Task Assignments RLS
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- 할당받은 사람은 자신의 업무를 볼 수 있음
CREATE POLICY task_assignments_assigned_view ON task_assignments
    FOR SELECT USING (
        assigned_to IN (
            SELECT id FROM team_members 
            WHERE user_profile_id = auth.uid()
        )
    );

-- 조직 관리자는 모든 업무를 관리할 수 있음
CREATE POLICY task_assignments_manage_policy ON task_assignments
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM user_profiles 
            WHERE id = auth.uid() 
            AND role IN ('local_admin', 'regional_admin')
        )
    );

-- Inspection Schedules RLS
ALTER TABLE inspection_schedules ENABLE ROW LEVEL SECURITY;

-- 조직 구성원은 일정을 볼 수 있음
CREATE POLICY inspection_schedules_view_policy ON inspection_schedules
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM user_profiles 
            WHERE id = auth.uid()
        )
    );

-- 관리자만 일정을 생성/수정할 수 있음
CREATE POLICY inspection_schedules_manage_policy ON inspection_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND organization_id = inspection_schedules.organization_id
            AND role IN ('local_admin', 'regional_admin')
        )
    );

-- ============================================
-- 10. 헬퍼 함수들
-- ============================================

-- 팀원이 특정 조직에 속하는지 확인
CREATE OR REPLACE FUNCTION is_team_member_of_organization(
    p_team_member_id UUID,
    p_organization_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM team_members 
        WHERE id = p_team_member_id 
        AND organization_id = p_organization_id
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql;

-- 사용자가 팀 관리 권한이 있는지 확인
CREATE OR REPLACE FUNCTION has_team_management_permission(
    p_user_id UUID,
    p_organization_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = p_user_id 
        AND organization_id = p_organization_id
        AND role IN ('local_admin', 'regional_admin', 'emergency_center_admin', 'master')
    );
END;
$$ LANGUAGE plpgsql;

-- 다음 점검 일정 자동 생성
CREATE OR REPLACE FUNCTION create_next_schedule_instances() RETURNS void AS $$
DECLARE
    v_schedule RECORD;
    v_next_date DATE;
BEGIN
    FOR v_schedule IN 
        SELECT * FROM inspection_schedules 
        WHERE is_active = true 
        AND is_recurring = true
    LOOP
        -- 반복 패턴에 따라 다음 일정 계산
        -- (실제 구현은 recurrence_pattern JSONB 구조에 따라 달라짐)
        
        -- 예시: 월간 반복
        IF v_schedule.schedule_type = 'monthly' THEN
            v_next_date := date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
            
            INSERT INTO schedule_instances (
                schedule_id,
                scheduled_date,
                assigned_inspector,
                status
            ) VALUES (
                v_schedule.id,
                v_next_date,
                v_schedule.primary_inspector,
                'scheduled'
            ) ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. 뷰 생성
-- ============================================

-- 팀원 상세 정보 뷰
CREATE OR REPLACE VIEW team_members_detail AS
SELECT 
    tm.*,
    up.full_name as user_full_name,
    up.email as user_email,
    up.role as user_role,
    o.name as organization_name,
    added.full_name as added_by_name
FROM team_members tm
LEFT JOIN user_profiles up ON tm.user_profile_id = up.id
LEFT JOIN organizations o ON tm.organization_id = o.id
LEFT JOIN user_profiles added ON tm.added_by = added.id;

-- 업무 할당 현황 뷰
CREATE OR REPLACE VIEW task_assignment_status AS
SELECT 
    ta.*,
    tm.name as assigned_to_name,
    tm.email as assigned_to_email,
    assigner.full_name as assigned_by_name,
    o.name as organization_name,
    ad.name as aed_device_name,
    ad.location as aed_location
FROM task_assignments ta
LEFT JOIN team_members tm ON ta.assigned_to = tm.id
LEFT JOIN user_profiles assigner ON ta.assigned_by = assigner.id
LEFT JOIN organizations o ON ta.organization_id = o.id
LEFT JOIN aed_devices ad ON ta.aed_device_id = ad.id;

-- 점검 일정 현황 뷰
CREATE OR REPLACE VIEW inspection_schedule_overview AS
SELECT 
    is_.*,
    tm1.name as primary_inspector_name,
    tm2.name as backup_inspector_name,
    o.name as organization_name,
    creator.full_name as created_by_name,
    (
        SELECT COUNT(*) FROM schedule_instances si 
        WHERE si.schedule_id = is_.id 
        AND si.status = 'completed'
    ) as completed_count,
    (
        SELECT COUNT(*) FROM schedule_instances si 
        WHERE si.schedule_id = is_.id 
        AND si.status = 'scheduled'
    ) as scheduled_count
FROM inspection_schedules is_
LEFT JOIN team_members tm1 ON is_.primary_inspector = tm1.id
LEFT JOIN team_members tm2 ON is_.backup_inspector = tm2.id
LEFT JOIN organizations o ON is_.organization_id = o.id
LEFT JOIN user_profiles creator ON is_.created_by = creator.id;

-- ============================================
-- 12. 샘플 데이터 (개발용)
-- ============================================
-- 주석 처리됨 - 필요시 활성화

/*
-- 샘플 팀원 추가
INSERT INTO team_members (organization_id, name, email, phone, member_type, added_by) VALUES
    ((SELECT id FROM organizations WHERE name = '서울특별시' LIMIT 1), '김점검', 'kim@example.com', '010-1234-5678', 'temporary', (SELECT id FROM user_profiles WHERE role = 'master' LIMIT 1)),
    ((SELECT id FROM organizations WHERE name = '서울특별시' LIMIT 1), '이점검', 'lee@example.com', '010-2345-6789', 'permanent', (SELECT id FROM user_profiles WHERE role = 'master' LIMIT 1));

-- 샘플 업무 할당
INSERT INTO task_assignments (organization_id, task_type, title, description, assigned_to, assigned_by, scheduled_date) VALUES
    ((SELECT id FROM organizations WHERE name = '서울특별시' LIMIT 1), 'inspection', '월간 정기 점검', '1층 AED 점검', (SELECT id FROM team_members LIMIT 1), (SELECT id FROM user_profiles WHERE role = 'master' LIMIT 1), CURRENT_DATE + INTERVAL '7 days');
*/