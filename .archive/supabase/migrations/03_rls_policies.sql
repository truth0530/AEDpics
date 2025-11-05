-- ============================================
-- Migration 03: RLS (Row Level Security) 정책 설정
-- 실행일: 2025-09-10
-- 목적: 테이블별 보안 정책 적용
-- ============================================

-- ============================================
-- 1. RLS 활성화
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Organizations 테이블 정책
-- ============================================

-- 모든 사용자가 조직 정보 조회 가능
CREATE POLICY "organizations_select_all" ON organizations
    FOR SELECT USING (true);

-- Master와 Admin만 조직 정보 수정
CREATE POLICY "organizations_modify_admin" ON organizations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('master', 'emergency_center_admin')
            AND user_profiles.is_active = true
        )
    );

-- ============================================
-- 3. User Profiles 테이블 정책
-- ============================================

-- Master 권한: 모든 프로필 접근
CREATE POLICY "master_all_access" ON user_profiles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'master'
        )
    );

-- 본인 프로필 조회 및 수정
CREATE POLICY "users_own_profile" ON user_profiles
    FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 관리자는 모든 프로필 조회 가능
CREATE POLICY "admin_view_all_profiles" ON user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin')
            AND user_profiles.is_active = true
        )
    );

-- 승인 권한자는 pending_approval 사용자 수정 가능
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
    WITH CHECK (role = 'pending_approval' OR role = 'email_verified');