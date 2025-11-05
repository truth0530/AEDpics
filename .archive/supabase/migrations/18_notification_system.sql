-- 알림 시스템 테이블 생성
-- 2025-09-20

-- 사용자 알림 설정
CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{
    "enabled": true,
    "types": {
      "task_assigned": true,
      "task_completed": true,
      "task_overdue": true,
      "schedule_reminder": true,
      "inspection_due": true,
      "team_update": true,
      "system": true
    },
    "sound": true,
    "vibration": true
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 알림 히스토리
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 인덱스
  INDEX idx_notification_user_read (user_id, read),
  INDEX idx_notification_created (created_at DESC)
);

-- 예약된 알림
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 인덱스
  INDEX idx_scheduled_status_time (status, scheduled_time)
);

-- Push 구독 정보
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 인덱스
  INDEX idx_push_user (user_id)
);

-- RLS 정책
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 설정만 관리
CREATE POLICY "Users can manage their own notification settings"
  ON user_notification_settings
  FOR ALL
  USING (auth.uid() = user_id);

-- 사용자는 자신의 알림만 조회/관리
CREATE POLICY "Users can view their own notifications"
  ON notification_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notification_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notification_history
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자는 자신의 예약 알림만 관리
CREATE POLICY "Users can manage their scheduled notifications"
  ON scheduled_notifications
  FOR ALL
  USING (auth.uid() = user_id);

-- 사용자는 자신의 Push 구독만 관리
CREATE POLICY "Users can manage their push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_notification_settings_updated_at
  BEFORE UPDATE ON user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 팀 알림 채널 (Realtime 브로드캐스트용)
-- Realtime은 테이블이 아닌 채널로 동작하므로 별도 테이블 불필요

-- 알림 통계 뷰
CREATE OR REPLACE VIEW notification_stats AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE NOT read) AS unread_count,
  COUNT(*) AS total_count,
  MAX(created_at) AS last_notification_at,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS today_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS week_count
FROM notification_history
GROUP BY user_id;

-- 권한 부여
GRANT SELECT ON notification_stats TO authenticated;

COMMENT ON TABLE user_notification_settings IS '사용자별 알림 설정';
COMMENT ON TABLE notification_history IS '알림 히스토리';
COMMENT ON TABLE scheduled_notifications IS '예약된 알림';
COMMENT ON TABLE push_subscriptions IS 'Push 알림 구독 정보';
COMMENT ON VIEW notification_stats IS '알림 통계 뷰';