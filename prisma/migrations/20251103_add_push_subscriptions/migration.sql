-- CreateTable: push_subscriptions
CREATE TABLE IF NOT EXISTS aedpics.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint varchar(500) NOT NULL,
  p256dh_key varchar(200) NOT NULL,
  auth_key varchar(200) NOT NULL,
  user_agent varchar(500),
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at timestamptz(6),

  CONSTRAINT fk_push_subscriptions_user_id
    FOREIGN KEY (user_id)
    REFERENCES aedpics.user_profiles(id)
    ON DELETE CASCADE,

  CONSTRAINT uq_push_subscriptions_user_endpoint
    UNIQUE (user_id, endpoint)
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON aedpics.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON aedpics.push_subscriptions(endpoint);

-- Add comment
COMMENT ON TABLE aedpics.push_subscriptions IS '푸시 알림 구독 정보';
