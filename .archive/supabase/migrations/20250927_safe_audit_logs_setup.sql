-- 안전한 audit_logs 테이블 설정
-- 이미 존재하는 경우를 고려한 멱등성 스크립트

-- 1. 테이블 생성 (IF NOT EXISTS)
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

-- 2. 인덱스 생성 (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
    ON public.audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
    ON public.audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
    ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON public.audit_logs(entity_type, entity_id)
    WHERE entity_type IS NOT NULL;

-- 3. RLS 설정
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. 기존 정책 삭제 (안전하게)
DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_service_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_authenticated_insert" ON public.audit_logs;

-- 5. 새 정책 생성
-- 관리자는 모든 로그 읽기 가능
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'emergency_center_admin', 'ministry_admin')
        )
    );

-- 사용자는 자신의 로그만 읽기 가능
CREATE POLICY "audit_logs_own_read" ON public.audit_logs
    FOR SELECT
    USING (user_id = auth.uid());

-- 인증된 사용자는 로그 추가 가능 (자신의 ID로만)
CREATE POLICY "audit_logs_authenticated_insert" ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND (user_id IS NULL OR user_id = auth.uid())
    );

-- 6. 권한 설정
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- 7. 뷰 생성 (통계용)
CREATE OR REPLACE VIEW public.audit_logs_summary AS
SELECT
    DATE(created_at) as date,
    action,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_users
FROM public.audit_logs
GROUP BY DATE(created_at), action;

-- 8. 뷰 권한 설정
GRANT SELECT ON public.audit_logs_summary TO authenticated;

-- 9. 헬퍼 함수 생성
CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_action TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_log_id UUID;
BEGIN
    -- 현재 사용자 ID 가져오기
    v_user_id := auth.uid();

    -- 로그 삽입
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        metadata
    )
    VALUES (
        v_user_id,
        p_action,
        p_entity_type,
        p_entity_id,
        p_metadata
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- 10. 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- 11. 초기 데이터 (선택적)
DO $$
BEGIN
    -- 테이블이 비어있으면 초기 로그 추가
    IF NOT EXISTS (SELECT 1 FROM public.audit_logs LIMIT 1) THEN
        INSERT INTO public.audit_logs (action, metadata)
        VALUES ('system_initialized', '{"message": "Audit log system initialized"}'::jsonb);
    END IF;
END
$$;

-- 12. 테이블 코멘트
COMMENT ON TABLE public.audit_logs IS '사용자 활동 감사 로그';
COMMENT ON COLUMN public.audit_logs.action IS '수행된 작업 (예: user_approved, user_rejected)';
COMMENT ON COLUMN public.audit_logs.entity_type IS '대상 엔티티 타입 (예: user, aed_device)';
COMMENT ON COLUMN public.audit_logs.entity_id IS '대상 엔티티 ID';
COMMENT ON COLUMN public.audit_logs.metadata IS '추가 메타데이터 (JSON)';

-- 결과 확인
SELECT 'Audit logs setup completed' as status,
       (SELECT COUNT(*) FROM public.audit_logs) as total_logs,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'audit_logs') as policies_count;