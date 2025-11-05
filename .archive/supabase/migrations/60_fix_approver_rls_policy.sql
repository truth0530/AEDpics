-- ============================================
-- Migration 60: Fix approver RLS policy for user_profiles
-- 실행일: 2025-10-14
-- 목적: 승인자가 사용자를 모든 역할로 승인할 수 있도록 RLS 정책 수정
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "approver_can_modify_pending" ON user_profiles;

-- 새로운 정책 생성: 승인자는 모든 역할로 사용자를 승인할 수 있음
CREATE POLICY "approver_can_modify_pending" ON user_profiles
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.can_approve_users = true
            AND user_profiles.is_active = true
        )
    )
    WITH CHECK (
        -- 승인자는 모든 유효한 역할로 변경 가능
        role IN (
            'pending_approval',
            'email_verified',
            'local_admin',
            'regional_admin',
            'regional_emergency_center_admin',
            'ministry_admin',
            'emergency_center_admin',
            'master'
        )
    );
