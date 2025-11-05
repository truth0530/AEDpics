-- OTP Rate Limiting 테이블 생성
-- 서버 사이드에서 OTP 요청 빈도를 제한하기 위한 테이블

CREATE TABLE IF NOT EXISTS otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  first_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 이메일별 인덱스 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_email ON otp_rate_limits(email);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_window_expires ON otp_rate_limits(window_expires_at);

-- 만료된 레코드 자동 삭제를 위한 함수
CREATE OR REPLACE FUNCTION cleanup_expired_otp_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM otp_rate_limits
  WHERE window_expires_at < NOW() - INTERVAL '1 day';
END;
$$;

-- 코멘트 추가
COMMENT ON TABLE otp_rate_limits IS 'OTP 요청 빈도 제한 추적 테이블';
COMMENT ON COLUMN otp_rate_limits.email IS '요청자 이메일';
COMMENT ON COLUMN otp_rate_limits.request_count IS '현재 윈도우 내 요청 횟수';
COMMENT ON COLUMN otp_rate_limits.first_request_at IS '현재 윈도우의 첫 요청 시간';
COMMENT ON COLUMN otp_rate_limits.last_request_at IS '마지막 요청 시간';
COMMENT ON COLUMN otp_rate_limits.window_expires_at IS '현재 윈도우 만료 시간 (15분)';
