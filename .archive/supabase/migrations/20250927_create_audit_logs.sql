-- audit_logs 테이블 생성 (없는 경우에만)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS 활성화
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 읽기 가능
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.user_profiles
            WHERE role IN ('master', 'emergency_center_admin', 'ministry_admin')
        )
    );

-- 시스템만 쓰기 가능 (service role 통해서만)
CREATE POLICY "audit_logs_service_insert" ON public.audit_logs
    FOR INSERT
    WITH CHECK (false);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;