-- 기존 사용자 계정 도메인 불일치 감사
-- 목적: 도메인 검증 로직 배포 전 기존 계정 검토
-- 작성일: 2025-10-18
-- 참조: docs/analysis/region-code-policy-comparison.md Phase 1
--
-- 보안 정책:
-- - @nmc.or.kr 도메인 → emergency_center_admin, regional_emergency_center_admin만 가능
-- - @korea.kr 도메인 → ministry_admin, regional_admin, local_admin만 가능
-- - 기타 도메인 → temporary_inspector만 가능
-- - master 역할 → 모든 도메인 허용 (시스템 최고 관리자)

-- ============================================================================
-- 1. 도메인 불일치 계정 조회 (전체)
-- ============================================================================
SELECT
  id,
  email,
  role,
  created_at,
  last_sign_in_at,
  SPLIT_PART(email, '@', 2) AS email_domain,
  CASE
    WHEN role IN ('emergency_center_admin', 'regional_emergency_center_admin')
      AND LOWER(SPLIT_PART(email, '@', 2)) != 'nmc.or.kr'
      THEN '⚠️ CRITICAL: @nmc.or.kr 필요'
    WHEN role IN ('ministry_admin', 'regional_admin', 'local_admin')
      AND LOWER(SPLIT_PART(email, '@', 2)) != 'korea.kr'
      THEN '⚠️ CRITICAL: @korea.kr 필요'
    WHEN role = 'temporary_inspector'
      AND LOWER(SPLIT_PART(email, '@', 2)) IN ('korea.kr', 'nmc.or.kr')
      THEN '⚠️ CRITICAL: 정부 도메인은 관리자 역할 필수'
    ELSE '✅ OK'
  END AS domain_status,
  CASE
    WHEN role IN ('emergency_center_admin', 'regional_emergency_center_admin')
      THEN '@nmc.or.kr 필요'
    WHEN role IN ('ministry_admin', 'regional_admin', 'local_admin')
      THEN '@korea.kr 필요'
    WHEN role = 'temporary_inspector'
      THEN '기타 도메인만 허용'
    ELSE '제한 없음 (master)'
  END AS required_domain
FROM user_profiles
WHERE
  -- 도메인 불일치만 조회
  CASE
    WHEN role IN ('emergency_center_admin', 'regional_emergency_center_admin')
      AND LOWER(SPLIT_PART(email, '@', 2)) != 'nmc.or.kr'
      THEN TRUE
    WHEN role IN ('ministry_admin', 'regional_admin', 'local_admin')
      AND LOWER(SPLIT_PART(email, '@', 2)) != 'korea.kr'
      THEN TRUE
    WHEN role = 'temporary_inspector'
      AND LOWER(SPLIT_PART(email, '@', 2)) IN ('korea.kr', 'nmc.or.kr')
      THEN TRUE
    ELSE FALSE
  END
ORDER BY
  CASE
    WHEN role IN ('emergency_center_admin', 'regional_emergency_center_admin', 'ministry_admin', 'regional_admin', 'local_admin')
      THEN 1  -- Critical (정부기관 역할)
    ELSE 2  -- Warning (temporary_inspector)
  END,
  created_at DESC;

-- ============================================================================
-- 2. 역할별 도메인 분포 통계
-- ============================================================================
SELECT
  role,
  LOWER(SPLIT_PART(email, '@', 2)) AS email_domain,
  COUNT(*) AS count,
  CASE
    WHEN role IN ('emergency_center_admin', 'regional_emergency_center_admin')
      AND LOWER(SPLIT_PART(email, '@', 2)) = 'nmc.or.kr'
      THEN '✅ 정상'
    WHEN role IN ('ministry_admin', 'regional_admin', 'local_admin')
      AND LOWER(SPLIT_PART(email, '@', 2)) = 'korea.kr'
      THEN '✅ 정상'
    WHEN role = 'master'
      THEN '✅ 정상 (제한 없음)'
    WHEN role = 'temporary_inspector'
      AND LOWER(SPLIT_PART(email, '@', 2)) NOT IN ('korea.kr', 'nmc.or.kr')
      THEN '✅ 정상'
    ELSE '⚠️ 불일치'
  END AS status
FROM user_profiles
GROUP BY role, LOWER(SPLIT_PART(email, '@', 2))
ORDER BY role, email_domain;

-- ============================================================================
-- 3. Critical 이슈: @nmc.or.kr 필요한데 다른 도메인 사용
-- ============================================================================
SELECT
  id,
  email,
  role,
  created_at,
  last_sign_in_at,
  LOWER(SPLIT_PART(email, '@', 2)) AS email_domain
FROM user_profiles
WHERE
  role IN ('emergency_center_admin', 'regional_emergency_center_admin')
  AND LOWER(SPLIT_PART(email, '@', 2)) != 'nmc.or.kr'
ORDER BY created_at DESC;

-- ============================================================================
-- 4. Critical 이슈: @korea.kr 필요한데 다른 도메인 사용
-- ============================================================================
SELECT
  id,
  email,
  role,
  created_at,
  last_sign_in_at,
  LOWER(SPLIT_PART(email, '@', 2)) AS email_domain,
  CASE
    WHEN role = 'ministry_admin' THEN '보건복지부'
    WHEN role = 'regional_admin' THEN '시청/도청'
    WHEN role = 'local_admin' THEN '보건소'
  END AS organization_type
FROM user_profiles
WHERE
  role IN ('ministry_admin', 'regional_admin', 'local_admin')
  AND LOWER(SPLIT_PART(email, '@', 2)) != 'korea.kr'
ORDER BY
  CASE role
    WHEN 'ministry_admin' THEN 1
    WHEN 'regional_admin' THEN 2
    WHEN 'local_admin' THEN 3
  END,
  created_at DESC;

-- ============================================================================
-- 5. Critical 이슈: temporary_inspector가 정부 도메인 사용
--    (정부 직원인데 temporary_inspector로 등록된 케이스)
-- ============================================================================
SELECT
  id,
  email,
  role,
  created_at,
  last_sign_in_at,
  LOWER(SPLIT_PART(email, '@', 2)) AS email_domain
FROM user_profiles
WHERE
  role = 'temporary_inspector'
  AND LOWER(SPLIT_PART(email, '@', 2)) IN ('korea.kr', 'nmc.or.kr')
ORDER BY created_at DESC;

-- ============================================================================
-- 6. 조치 필요 계정 수 요약
-- ============================================================================
SELECT
  '도메인 불일치 계정 총 수' AS category,
  COUNT(*) AS count
FROM user_profiles
WHERE
  CASE
    WHEN role IN ('emergency_center_admin', 'regional_emergency_center_admin')
      AND LOWER(SPLIT_PART(email, '@', 2)) != 'nmc.or.kr'
      THEN TRUE
    WHEN role IN ('ministry_admin', 'regional_admin', 'local_admin')
      AND LOWER(SPLIT_PART(email, '@', 2)) != 'korea.kr'
      THEN TRUE
    WHEN role = 'temporary_inspector'
      AND LOWER(SPLIT_PART(email, '@', 2)) IN ('korea.kr', 'nmc.or.kr')
      THEN TRUE
    ELSE FALSE
  END

UNION ALL

SELECT
  'Critical: @nmc.or.kr 필요' AS category,
  COUNT(*) AS count
FROM user_profiles
WHERE
  role IN ('emergency_center_admin', 'regional_emergency_center_admin')
  AND LOWER(SPLIT_PART(email, '@', 2)) != 'nmc.or.kr'

UNION ALL

SELECT
  'Critical: @korea.kr 필요' AS category,
  COUNT(*) AS count
FROM user_profiles
WHERE
  role IN ('ministry_admin', 'regional_admin', 'local_admin')
  AND LOWER(SPLIT_PART(email, '@', 2)) != 'korea.kr'

UNION ALL

SELECT
  'Warning: temporary_inspector 정부 도메인' AS category,
  COUNT(*) AS count
FROM user_profiles
WHERE
  role = 'temporary_inspector'
  AND LOWER(SPLIT_PART(email, '@', 2)) IN ('korea.kr', 'nmc.or.kr');

-- ============================================================================
-- 7. 조치 계획 템플릿 (수동 실행 필요)
-- ============================================================================

-- ⚠️ 주의: 아래 쿼리는 실제 데이터 수정이므로 신중히 검토 후 실행

-- 옵션 1: 역할 변경 (예: local_admin → temporary_inspector)
-- UPDATE user_profiles
-- SET role = 'temporary_inspector', updated_at = NOW()
-- WHERE id = '<user-id>'
--   AND email = '<user-email>'
--   AND role = 'local_admin'
--   AND LOWER(SPLIT_PART(email, '@', 2)) != 'korea.kr';

-- 옵션 2: 계정 비활성화 (삭제 대신)
-- UPDATE user_profiles
-- SET role = 'pending_approval', updated_at = NOW()
-- WHERE id = '<user-id>'
--   AND LOWER(SPLIT_PART(email, '@', 2)) NOT IN ('korea.kr', 'nmc.or.kr')
--   AND role IN ('ministry_admin', 'regional_admin', 'local_admin', 'emergency_center_admin', 'regional_emergency_center_admin');

-- 옵션 3: 계정 완전 삭제 (최후의 수단)
-- DELETE FROM user_profiles
-- WHERE id = '<user-id>'
--   AND email = '<user-email>';

-- ============================================================================
-- 8. 감사 로그 기록 (선택적)
-- ============================================================================

-- 감사 로그 테이블 생성 (아직 없는 경우)
-- CREATE TABLE IF NOT EXISTS user_audit_logs (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   user_id UUID,
--   email TEXT,
--   old_role TEXT,
--   new_role TEXT,
--   action TEXT,
--   reason TEXT,
--   performed_by TEXT,
--   performed_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- 도메인 불일치 감사 로그 삽입
-- INSERT INTO user_audit_logs (user_id, email, old_role, new_role, action, reason, performed_by)
-- SELECT
--   id,
--   email,
--   role,
--   'pending_approval',
--   'domain_mismatch_audit',
--   '도메인 검증 로직 배포 전 불일치 계정 조치',
--   'system'
-- FROM user_profiles
-- WHERE ... (불일치 조건);

-- ============================================================================
-- 사용 방법:
--
-- 1. Supabase SQL Editor에서 쿼리 1-6 실행
-- 2. 결과 검토 및 CSV 다운로드
-- 3. 팀과 조치 계획 협의
-- 4. 승인 후 쿼리 7의 조치 실행
-- 5. (선택) 쿼리 8로 감사 로그 기록
--
-- ============================================================================
