-- ============================================
-- Migration: 20250920_add_inspection_schedule_entries
-- 목적: Stage 1 스케줄링 MVP를 위한 단일 일정 테이블 추가
-- ============================================

CREATE TABLE IF NOT EXISTS public.inspection_schedule_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_equipment_serial VARCHAR(255) NOT NULL REFERENCES aed_data(equipment_serial) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    assignee_identifier TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspection_schedule_entries_device ON inspection_schedule_entries(device_equipment_serial);
CREATE INDEX IF NOT EXISTS idx_inspection_schedule_entries_scheduled_for ON inspection_schedule_entries(scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_schedule_entries_created_by ON inspection_schedule_entries(created_by);

CREATE TRIGGER trg_inspection_schedule_entries_updated_at
    BEFORE UPDATE ON public.inspection_schedule_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.inspection_schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY inspection_schedule_entries_select ON public.inspection_schedule_entries
    FOR SELECT USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin')
        )
    );

CREATE POLICY inspection_schedule_entries_insert ON public.inspection_schedule_entries
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin')
        )
    );

CREATE POLICY inspection_schedule_entries_update ON public.inspection_schedule_entries
    FOR UPDATE USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin')
        )
    )
    WITH CHECK (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin')
        )
    );

CREATE POLICY inspection_schedule_entries_delete ON public.inspection_schedule_entries
    FOR DELETE USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin')
        )
    );

COMMENT ON TABLE public.inspection_schedule_entries IS 'Stage 1 점검 스케줄링을 위한 단건 일정 테이블';
COMMENT ON COLUMN public.inspection_schedule_entries.assignee_identifier IS '담당자 이메일 또는 식별 정보';
