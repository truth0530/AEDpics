-- Migration: Add temporary_inspector role to user_profiles CHECK constraint
-- Date: 2025-10-18
-- Purpose: 도메인 기반 역할 검증 보안 패치
--
-- Background:
-- - 비정부 도메인 사용자는 temporary_inspector 역할만 부여 가능
-- - 기존 CHECK constraint에 temporary_inspector가 누락되어 있었음
-- - mentalchange@naver.com 계정을 temporary_inspector로 변경하는 과정에서 발견
--
-- Changes:
-- 1. user_profiles.role CHECK constraint에 'temporary_inspector' 추가
-- 2. 기존 계정 중 도메인 불일치 케이스 수정 완료 (mentalchange@naver.com)

-- ============================================================================
-- 1. 기존 role CHECK constraint 삭제
-- ============================================================================
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- ============================================================================
-- 2. temporary_inspector를 포함한 새로운 CHECK constraint 추가
-- ============================================================================
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
CHECK (role = ANY (ARRAY[
  'master'::text,
  'emergency_center_admin'::text,
  'regional_emergency_center_admin'::text,
  'ministry_admin'::text,
  'regional_admin'::text,
  'local_admin'::text,
  'temporary_inspector'::text,  -- ✅ 추가됨
  'pending_approval'::text,
  'email_verified'::text
]));

-- ============================================================================
-- 3. 도메인 검증 함수 (선택적 - RLS 정책에서 사용 가능)
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_user_role_domain()
RETURNS TRIGGER AS $$
BEGIN
  -- master 역할은 모든 도메인 허용
  IF NEW.role = 'master' THEN
    RETURN NEW;
  END IF;

  -- 이메일 도메인 추출
  DECLARE
    email_domain TEXT := LOWER(SPLIT_PART(NEW.email, '@', 2));
  BEGIN
    -- @nmc.or.kr 도메인 - 응급센터 관리자만 가능
    IF email_domain = 'nmc.or.kr' THEN
      IF NEW.role NOT IN ('emergency_center_admin', 'regional_emergency_center_admin') THEN
        RAISE EXCEPTION 'Domain % can only have emergency center admin roles, got %',
          email_domain, NEW.role;
      END IF;
    -- @korea.kr 도메인 - 정부기관 관리자만 가능
    ELSIF email_domain = 'korea.kr' THEN
      IF NEW.role NOT IN ('ministry_admin', 'regional_admin', 'local_admin') THEN
        RAISE EXCEPTION 'Domain % can only have government admin roles, got %',
          email_domain, NEW.role;
      END IF;
    -- 기타 도메인 - temporary_inspector만 가능 (pending_approval, email_verified 제외)
    ELSE
      IF NEW.role NOT IN ('temporary_inspector', 'pending_approval', 'email_verified') THEN
        RAISE EXCEPTION 'Non-government domain % can only have role temporary_inspector, got %',
          email_domain, NEW.role;
      END IF;
    END IF;

    RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Trigger 생성 (선택적 - 필요 시 주석 해제)
-- ============================================================================
-- 주의: 이 트리거는 매우 엄격합니다. 관리자가 수동으로 역할을 변경할 때도 검증됩니다.
-- 필요한 경우에만 활성화하세요.

-- DROP TRIGGER IF EXISTS validate_user_role_domain_trigger ON user_profiles;
-- CREATE TRIGGER validate_user_role_domain_trigger
--   BEFORE INSERT OR UPDATE OF role, email ON user_profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION validate_user_role_domain();

-- ============================================================================
-- 5. 마이그레이션 검증
-- ============================================================================
DO $$
BEGIN
  -- temporary_inspector 역할이 CHECK constraint에 포함되었는지 확인
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_role_check'
    AND pg_get_constraintdef(oid) LIKE '%temporary_inspector%'
  ) THEN
    RAISE NOTICE '✅ Migration successful: temporary_inspector role added to CHECK constraint';
  ELSE
    RAISE EXCEPTION '❌ Migration failed: temporary_inspector not found in CHECK constraint';
  END IF;
END $$;

-- ============================================================================
-- 6. 감사 로그
-- ============================================================================
COMMENT ON CONSTRAINT user_profiles_role_check ON user_profiles IS
  'Updated 2025-10-18: Added temporary_inspector role for non-government domain users.
   See migration 20251018_add_temporary_inspector_role.sql';
