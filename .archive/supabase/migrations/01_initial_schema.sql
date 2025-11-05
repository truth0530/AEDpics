-- ============================================
-- Migration 01: 초기 스키마 설정
-- 실행일: 2025-09-10
-- 목적: 기본 테이블 및 조직 구조 생성
-- ============================================

-- 기존 테이블 정리 (초기 설정용)
DROP TABLE IF EXISTS public.email_verification_codes CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- ============================================
-- 1. Organizations 테이블 생성
-- ============================================
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ministry', 'emergency_center', 'province', 'city', 'health_center')),
    parent_id UUID REFERENCES organizations(id),
    region_code TEXT,
    address TEXT,
    contact TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. User Profiles 테이블 생성 (간소화 버전)
-- ============================================
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    organization_id UUID REFERENCES organizations(id),
    role TEXT NOT NULL CHECK (role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin', 'pending_approval', 'email_verified')),
    is_active BOOLEAN DEFAULT true,
    approved_by UUID REFERENCES user_profiles(id),
    approved_at TIMESTAMPTZ,
    
    -- 회원가입 시 입력 정보
    region TEXT,
    organization_name TEXT,
    remarks TEXT,
    
    -- 관리자 추가 정보
    region_code TEXT,
    district TEXT,
    department TEXT,
    position TEXT,
    
    -- 권한 관련 (필수만)
    can_approve_users BOOLEAN DEFAULT false,
    can_manage_devices BOOLEAN DEFAULT true,
    can_view_reports BOOLEAN DEFAULT true,
    can_export_data BOOLEAN DEFAULT false,
    
    -- 계정 상태 (필수만)
    last_login_at TIMESTAMPTZ,
    account_locked BOOLEAN DEFAULT false,
    lock_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 인덱스 생성
-- ============================================
CREATE INDEX idx_organizations_region ON organizations(region_code);
CREATE INDEX idx_organizations_type ON organizations(type);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_organization_name ON user_profiles(organization_name);

-- ============================================
-- 4. 트리거 함수 생성
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON public.organizations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON public.user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();