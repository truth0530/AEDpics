-- Master 계정 초기화 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. 기존 Master 계정 확인
DO $$
DECLARE
  master_emails TEXT[] := ARRAY['truth0530@nmc.or.kr', 'inhak@nmc.or.kr', 'woo@nmc.or.kr'];
  email TEXT;
  user_id UUID;
BEGIN
  -- 각 Master 이메일에 대해 처리
  FOREACH email IN ARRAY master_emails
  LOOP
    -- 사용자가 이미 존재하는지 확인
    SELECT id INTO user_id FROM auth.users WHERE auth.users.email = email;

    IF user_id IS NULL THEN
      -- 사용자가 없으면 생성 (비밀번호는 첫 로그인 시 재설정 필요)
      INSERT INTO auth.users (
        id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        instance_id,
        aud,
        role,
        raw_app_meta_data,
        raw_user_meta_data
      ) VALUES (
        gen_random_uuid(),
        email,
        crypt('ChangeMeImmediately123!', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object('full_name',
          CASE
            WHEN email = 'truth0530@nmc.or.kr' THEN '시스템 관리자'
            WHEN email = 'inhak@nmc.or.kr' THEN '인학 관리자'
            WHEN email = 'woo@nmc.or.kr' THEN '우 관리자'
            ELSE 'Master Admin'
          END
        )
      )
      RETURNING id INTO user_id;

      RAISE NOTICE 'Created auth user for %', email;
    ELSE
      RAISE NOTICE 'Auth user already exists for %', email;
    END IF;

    -- 프로필이 없으면 생성
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_profiles.id = user_id) THEN
      INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at,
        account_type,
        region_code,
        organization_name
      ) VALUES (
        user_id,
        email,
        CASE
          WHEN email = 'truth0530@nmc.or.kr' THEN '시스템 관리자'
          WHEN email = 'inhak@nmc.or.kr' THEN '인학 관리자'
          WHEN email = 'woo@nmc.or.kr' THEN '우 관리자'
          ELSE 'Master Admin'
        END,
        'master',
        true,
        NOW(),
        NOW(),
        'public',
        '중앙',
        '중앙응급의료센터'
      );

      RAISE NOTICE 'Created profile for %', email;
    ELSE
      -- 프로필이 있으면 master 권한으로 업데이트
      UPDATE public.user_profiles
      SET
        role = 'master',
        is_active = true,
        account_type = 'public',
        updated_at = NOW()
      WHERE id = user_id AND role != 'master';

      RAISE NOTICE 'Updated profile for %', email;
    END IF;
  END LOOP;
END $$;

-- 2. 결과 확인
SELECT
  u.email,
  u.email_confirmed_at,
  p.full_name,
  p.role,
  p.is_active,
  p.created_at
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
WHERE u.email IN ('truth0530@nmc.or.kr', 'inhak@nmc.or.kr', 'woo@nmc.or.kr')
ORDER BY u.email;

-- 3. 중요 안내
-- 이 스크립트 실행 후:
-- 1) 각 Master 계정 소유자는 비밀번호 재설정을 해야 합니다
-- 2) 임시 비밀번호: ChangeMeImmediately123!
-- 3) 첫 로그인 시 즉시 비밀번호를 변경하세요