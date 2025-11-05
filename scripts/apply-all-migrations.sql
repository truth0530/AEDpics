-- ============================================
-- Complete Migration Script for AED System
-- Run this in Supabase Dashboard SQL Editor
-- Date: 2025-09-25
-- ============================================

-- 1. Create inspections table
CREATE TABLE IF NOT EXISTS public.inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aed_device_serial VARCHAR(255) NOT NULL,
    inspector_id UUID NOT NULL REFERENCES user_profiles(id),
    inspection_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    overall_score INTEGER,
    notes TEXT,
    inspection_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspections_device_serial ON inspections(aed_device_serial);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector ON inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(inspection_date DESC);

-- 2. Team Management Tables (from 05_team_management.sql)
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_profile_id UUID REFERENCES user_profiles(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    member_type VARCHAR(50) NOT NULL DEFAULT 'permanent',
    temporary_period_start DATE,
    temporary_period_end DATE,
    is_active BOOLEAN DEFAULT true,
    added_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    can_view_team_members BOOLEAN DEFAULT false,
    can_manage_team_members BOOLEAN DEFAULT false,
    can_assign_tasks BOOLEAN DEFAULT false,
    can_perform_inspections BOOLEAN DEFAULT true,
    can_view_reports BOOLEAN DEFAULT true,
    can_export_reports BOOLEAN DEFAULT false,
    can_manage_aed_devices BOOLEAN DEFAULT false,
    access_scope VARCHAR(50) DEFAULT 'assigned_only',
    granted_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    task_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES team_members(id),
    assigned_by UUID NOT NULL REFERENCES user_profiles(id),
    scheduled_date DATE,
    due_date DATE,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(50) DEFAULT 'pending',
    completion_date TIMESTAMPTZ,
    aed_device_serial VARCHAR(255),
    inspection_id UUID REFERENCES inspections(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inspection_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    schedule_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB,
    primary_inspector UUID REFERENCES team_members(id),
    backup_inspector UUID REFERENCES team_members(id),
    aed_device_serials TEXT[],
    aed_group_criteria JSONB,
    start_date DATE NOT NULL,
    end_date DATE,
    next_run_date DATE,
    reminder_days_before INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.schedule_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES inspection_schedules(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    assigned_inspector UUID REFERENCES team_members(id),
    status VARCHAR(50) DEFAULT 'pending',
    task_assignment_id UUID REFERENCES task_assignments(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    actor_id UUID NOT NULL REFERENCES user_profiles(id),
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Login and Profile Tracking
CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    login_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    login_method VARCHAR(50),
    session_duration INTERVAL,
    logout_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'success'
);

CREATE TABLE IF NOT EXISTS public.organization_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    current_organization_id UUID REFERENCES organizations(id),
    requested_organization_id UUID NOT NULL REFERENCES organizations(id),
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    reviewed_by UUID REFERENCES user_profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profile_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID NOT NULL REFERENCES user_profiles(id),
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. GPS Analysis Tables
CREATE TABLE IF NOT EXISTS public.gps_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_serial VARCHAR(255) NOT NULL,
    issue_type VARCHAR(50) NOT NULL,
    confidence_score DECIMAL(3,2),
    raw_latitude DECIMAL(10,8),
    raw_longitude DECIMAL(11,8),
    corrected_latitude DECIMAL(10,8),
    corrected_longitude DECIMAL(11,8),
    address_text TEXT,
    correction_method VARCHAR(50),
    is_resolved BOOLEAN DEFAULT false,
    resolver_user_id UUID REFERENCES user_profiles(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    priority_impact INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gps_analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_date DATE NOT NULL,
    total_devices_analyzed INTEGER,
    issues_found INTEGER,
    issues_by_type JSONB,
    processing_time_seconds DECIMAL(10,2),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Stage 1 MVP Schedule Entries
CREATE TABLE IF NOT EXISTS public.inspection_schedule_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_equipment_serial VARCHAR(255) NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    assignee_identifier TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create all indexes
CREATE INDEX IF NOT EXISTS idx_team_members_org ON team_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_permissions_member ON team_permissions(team_member_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_org ON task_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned ON task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inspection_schedules_org ON inspection_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_instances_schedule ON schedule_instances(schedule_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_org ON team_activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_org_change_requests_user ON organization_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_change_history_user ON profile_change_history(user_id);
CREATE INDEX IF NOT EXISTS idx_gps_issues_serial ON gps_issues(equipment_serial);
CREATE INDEX IF NOT EXISTS idx_gps_analysis_logs_date ON gps_analysis_logs(analysis_date);
CREATE INDEX IF NOT EXISTS idx_inspection_schedule_entries_device ON inspection_schedule_entries(device_equipment_serial);
CREATE INDEX IF NOT EXISTS idx_inspection_schedule_entries_scheduled ON inspection_schedule_entries(scheduled_for DESC);

-- Create update trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all tables with updated_at
CREATE TRIGGER trg_inspections_updated_at BEFORE UPDATE ON inspections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_team_permissions_updated_at BEFORE UPDATE ON team_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_task_assignments_updated_at BEFORE UPDATE ON task_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inspection_schedules_updated_at BEFORE UPDATE ON inspection_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_organization_change_requests_updated_at BEFORE UPDATE ON organization_change_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_gps_issues_updated_at BEFORE UPDATE ON gps_issues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inspection_schedule_entries_updated_at BEFORE UPDATE ON inspection_schedule_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_schedule_entries ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (adjust as needed based on your requirements)
-- These are permissive for authenticated users, you may want to make them more restrictive

-- Inspections policies
CREATE POLICY inspections_select ON inspections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY inspections_insert ON inspections FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY inspections_update ON inspections FOR UPDATE USING (inspector_id = auth.uid());

-- Team members policies
CREATE POLICY team_members_select ON team_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY team_members_insert ON team_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY team_members_update ON team_members FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Add more specific policies as needed...

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'All migrations completed successfully!';
END $$;