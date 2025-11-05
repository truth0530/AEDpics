-- ============================================
-- Migration 02: 초기 데이터 입력
-- 실행일: 2025-09-10
-- 목적: 기본 조직 데이터 및 Master 계정 설정
-- ============================================

-- ============================================
-- 1. 조직 데이터 입력
-- ============================================

-- 중앙응급의료센터
INSERT INTO organizations (name, type, region_code) 
VALUES ('중앙응급의료센터', 'emergency_center', 'KR')
ON CONFLICT DO NOTHING;

-- 보건복지부
INSERT INTO organizations (name, type, region_code) 
VALUES ('보건복지부', 'ministry', 'KR')
ON CONFLICT DO NOTHING;

-- 17개 시도
INSERT INTO organizations (name, type, region_code) VALUES
    ('서울특별시', 'province', 'SEO'),
    ('부산광역시', 'province', 'BUS'),
    ('대구광역시', 'province', 'DAE'),
    ('인천광역시', 'province', 'INC'),
    ('광주광역시', 'province', 'GWA'),
    ('대전광역시', 'province', 'DAJ'),
    ('울산광역시', 'province', 'ULS'),
    ('세종특별자치시', 'province', 'SEJ'),
    ('경기도', 'province', 'GYE'),
    ('강원도', 'province', 'GAN'),
    ('충청북도', 'province', 'CHB'),
    ('충청남도', 'province', 'CHN'),
    ('전라북도', 'province', 'JEB'),
    ('전라남도', 'province', 'JEN'),
    ('경상북도', 'province', 'GYB'),
    ('경상남도', 'province', 'GYN'),
    ('제주특별자치도', 'province', 'JEJ')
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. Master 계정 권한 업데이트
-- ============================================

-- truth0530@nmc.or.kr 계정을 Master로 설정 (이미 가입한 경우)
UPDATE user_profiles
SET 
    role = 'master',
    can_approve_users = true,
    can_export_data = true,
    is_active = true,
    organization_id = (SELECT id FROM organizations WHERE type = 'emergency_center' LIMIT 1)
WHERE email = 'truth0530@nmc.or.kr';

-- 다른 Master 계정들도 가입 시 자동 권한 부여를 위한 준비
-- (실제 가입 후 수동으로 권한 부여 필요)
-- inhak@nmc.or.kr
-- woo@nmc.or.kr