-- 로그인 이력 테이블 생성
CREATE TABLE IF NOT EXISTS login_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    login_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_login_history_user_id ON login_history(user_id);
CREATE INDEX idx_login_history_login_at ON login_history(login_at DESC);

-- user_profiles 테이블에 로그인 통계 컬럼 추가 (없으면)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- 로그인 이력 추가 함수
CREATE OR REPLACE FUNCTION record_user_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- 현재 로그인한 사용자 ID 가져오기
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RETURN;
    END IF;

    -- 로그인 이력 추가
    INSERT INTO login_history (user_id)
    VALUES (current_user_id);

    -- user_profiles 테이블 업데이트
    UPDATE user_profiles
    SET
        last_login_at = NOW(),
        login_count = COALESCE(login_count, 0) + 1,
        updated_at = NOW()
    WHERE id = current_user_id;
END;
$$;

-- RLS 정책 설정
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

-- 본인의 로그인 이력만 조회 가능
CREATE POLICY "Users can view own login history" ON login_history
    FOR SELECT USING (auth.uid() = user_id);

-- 관리자는 모든 로그인 이력 조회 가능
CREATE POLICY "Admins can view all login history" ON login_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'emergency_center_admin', 'ministry_admin')
        )
    );

-- 로그인 통계 뷰 생성 (선택적)
CREATE OR REPLACE VIEW user_login_stats AS
SELECT
    up.id,
    up.email,
    up.full_name,
    up.last_login_at,
    up.login_count,
    (
        SELECT COUNT(*)
        FROM login_history lh
        WHERE lh.user_id = up.id
        AND lh.login_at >= NOW() - INTERVAL '30 days'
    ) as login_count_30days,
    (
        SELECT COUNT(*)
        FROM login_history lh
        WHERE lh.user_id = up.id
        AND lh.login_at >= NOW() - INTERVAL '7 days'
    ) as login_count_7days
FROM user_profiles up;

-- 뷰에 대한 권한 설정
GRANT SELECT ON user_login_stats TO authenticated;

COMMENT ON TABLE login_history IS '사용자 로그인 이력';
COMMENT ON COLUMN login_history.user_id IS '사용자 ID';
COMMENT ON COLUMN login_history.login_at IS '로그인 시간';
COMMENT ON COLUMN user_profiles.last_login_at IS '최종 로그인 시간';
COMMENT ON COLUMN user_profiles.login_count IS '총 로그인 횟수';