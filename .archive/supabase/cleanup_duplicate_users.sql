-- 중복 사용자 정리 스크립트
-- auth.users에는 있지만 user_profiles에는 없는 사용자 찾기

-- 1. 먼저 상황 파악
SELECT
    au.id,
    au.email,
    au.created_at as auth_created,
    up.id as profile_id
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ORDER BY au.created_at DESC;

-- 2. 프로필이 없는 auth 사용자 삭제 (주의: 실행 전 반드시 확인!)
-- 주석 해제하여 실행
/*
DELETE FROM auth.users
WHERE id IN (
    SELECT au.id
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON au.id = up.id
    WHERE up.id IS NULL
);
*/

-- 3. 반대 경우 확인 (프로필은 있지만 auth에는 없는 경우)
SELECT
    up.id,
    up.email,
    up.created_at as profile_created,
    au.id as auth_id
FROM public.user_profiles up
LEFT JOIN auth.users au ON up.id = au.id
WHERE au.id IS NULL
ORDER BY up.created_at DESC;

-- 4. 고아 프로필 삭제 (주의: 실행 전 반드시 확인!)
-- 주석 해제하여 실행
/*
DELETE FROM public.user_profiles
WHERE id NOT IN (
    SELECT id FROM auth.users
);
*/

-- 5. 이메일 인증 코드 테이블 정리 (30일 이상된 것들)
DELETE FROM public.email_verification_codes
WHERE created_at < NOW() - INTERVAL '30 days';

-- 6. 사용된 인증 코드 정리
DELETE FROM public.email_verification_codes
WHERE used = true AND created_at < NOW() - INTERVAL '7 days';