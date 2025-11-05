-- 기존 INSERT 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

-- 더 엄격한 INSERT 정책 생성: 관리자나 시스템만 알림 생성 가능
CREATE POLICY "Only admins can create notifications" ON notifications
  FOR INSERT WITH CHECK (
    -- 마스터, 응급의료센터 관리자, 보건복지부 관리자만 알림 생성 가능
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('master', 'emergency_center_admin', 'ministry_admin')
    )
    OR
    -- 또는 서비스 역할 (서버 API)에서만 생성 가능
    current_setting('role') = 'service_role'
  );

-- 알림 템플릿 정책도 더 엄격하게 수정
DROP POLICY IF EXISTS "Only admins can modify templates" ON notification_templates;

CREATE POLICY "Only admins can modify notification templates" ON notification_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('master', 'emergency_center_admin')
    )
  );