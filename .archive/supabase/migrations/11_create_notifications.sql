-- 알림 시스템을 위한 notifications 테이블 생성
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  CONSTRAINT valid_notification_type CHECK (
    type IN (
      'new_signup',
      'approval_completed',
      'approval_rejected',
      'system_update',
      'organization_change_request',
      'role_updated'
    )
  )
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_notifications_recipient_unread ON notifications (recipient_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications (type);
CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX idx_notifications_expires_at ON notifications (expires_at) WHERE expires_at IS NOT NULL;

-- RLS 정책 설정
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 알림만 볼 수 있음
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = recipient_id);

-- 사용자는 자신의 알림만 업데이트 가능 (읽음 표시)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- 알림 생성은 인증된 사용자만 가능 (서비스 역할 또는 관리자)
CREATE POLICY "Authenticated users can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 자신이 생성한 알림은 삭제 가능
CREATE POLICY "Users can delete own sent notifications" ON notifications
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Realtime 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 만료된 알림 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
  -- 만료된 알림 삭제
  DELETE FROM notifications
  WHERE expires_at < NOW();

  -- 30일 이상된 읽은 알림 삭제
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND is_read = true;

  -- 90일 이상된 모든 알림 삭제
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- 알림 개수 조회 함수 (성능 최적화)
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE recipient_id = user_id
      AND is_read = false
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 알림 타입별 템플릿 테이블
CREATE TABLE notification_templates (
  type VARCHAR(50) PRIMARY KEY,
  title_template VARCHAR(255) NOT NULL,
  message_template TEXT NOT NULL,
  default_expiry_hours INTEGER,
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'))
);

-- 기본 알림 템플릿 데이터
INSERT INTO notification_templates VALUES
('new_signup', '새 회원가입 신청', '{userName}님({userEmail})이 {organizationName}에서 회원가입을 신청했습니다.', 168, true, true, 'high'),
('approval_completed', '계정 승인 완료', '회원가입 신청이 승인되었습니다. 이제 시스템을 이용하실 수 있습니다.', 720, true, false, 'medium'),
('approval_rejected', '계정 승인 거부', '회원가입 신청이 거부되었습니다. {reason}', 720, true, false, 'medium'),
('system_update', '시스템 업데이트', '시스템이 업데이트되었습니다. {updateDetails}', 24, false, true, 'low'),
('organization_change_request', '소속 변경 요청', '{userName}님이 소속 변경을 요청했습니다.', 72, true, true, 'medium'),
('role_updated', '권한 변경', '귀하의 권한이 {newRole}(으)로 변경되었습니다.', 168, true, false, 'medium');

-- 알림 템플릿에 RLS 적용
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 템플릿 조회 가능
CREATE POLICY "All users can view notification templates" ON notification_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 관리자만 템플릿 수정 가능
CREATE POLICY "Only admins can modify templates" ON notification_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('master', 'emergency_center_admin')
    )
  );