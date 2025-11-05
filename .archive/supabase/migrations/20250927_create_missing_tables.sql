-- 로그인 기록 테이블 생성
CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON public.login_history(created_at DESC);

-- RLS 활성화
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 로그인 기록만 볼 수 있음
CREATE POLICY "Users can view own login history" ON public.login_history
    FOR SELECT
    USING (user_id = auth.uid());

-- 관리자는 모든 로그인 기록을 볼 수 있음
CREATE POLICY "Admins can view all login history" ON public.login_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'emergency_center_admin', 'ministry_admin')
        )
    );

-- 시스템은 로그인 기록을 추가할 수 있음
CREATE POLICY "System can insert login history" ON public.login_history
    FOR INSERT
    WITH CHECK (true);

-- 로그인 기록 함수 생성
CREATE OR REPLACE FUNCTION public.record_user_login(
    p_user_id UUID DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_login_id UUID;
    v_user_id UUID;
BEGIN
    -- 사용자 ID가 제공되지 않은 경우 현재 사용자 사용
    v_user_id := COALESCE(p_user_id, auth.uid());

    -- 로그인 기록 삽입
    INSERT INTO public.login_history (
        user_id,
        ip_address,
        user_agent,
        success,
        login_time
    )
    VALUES (
        v_user_id,
        p_ip_address,
        p_user_agent,
        p_success,
        NOW()
    )
    RETURNING id INTO v_login_id;

    RETURN v_login_id;
END;
$$;

-- audit_logs 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT audit_logs_action_check CHECK (action != '')
);

-- audit_logs 인덱스
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id)
    WHERE entity_type IS NOT NULL;

-- RLS 활성화
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_own_read" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_authenticated_insert" ON public.audit_logs;

-- 새 정책 생성
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'emergency_center_admin', 'ministry_admin')
        )
    );

CREATE POLICY "audit_logs_own_read" ON public.audit_logs
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "audit_logs_authenticated_insert" ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (user_id IS NULL OR user_id = auth.uid())
    );

-- 권한 부여
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.login_history TO authenticated;
GRANT INSERT ON public.login_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_login TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;

-- 초기 데이터 (선택적)
DO $$
BEGIN
    -- audit_logs 테이블이 비어있으면 초기 로그 추가
    IF NOT EXISTS (SELECT 1 FROM public.audit_logs LIMIT 1) THEN
        INSERT INTO public.audit_logs (action, metadata)
        VALUES ('system_initialized', '{"message": "Audit log system initialized"}'::jsonb);
    END IF;
END
$$;

COMMENT ON TABLE public.login_history IS '사용자 로그인 기록';
COMMENT ON TABLE public.audit_logs IS '사용자 활동 감사 로그';
COMMENT ON FUNCTION public.record_user_login IS '사용자 로그인 기록 함수';