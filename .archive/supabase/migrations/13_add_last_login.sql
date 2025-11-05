-- user_profiles 테이블에 last_login_at 컬럼 추가
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 인덱스 추가 (로그인 시간별 정렬/필터링용)
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_login_at
ON user_profiles(last_login_at DESC);

-- 코멘트 추가
COMMENT ON COLUMN user_profiles.last_login_at IS '최종 로그인 시간';