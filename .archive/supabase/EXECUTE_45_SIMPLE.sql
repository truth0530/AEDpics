-- ============================================
-- Migration 45 간소화 버전: management_number_group_mapping 테이블만 생성
-- ============================================

-- 관리번호 그룹 매핑 테이블 생성
CREATE TABLE IF NOT EXISTS public.management_number_group_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 관리번호 (aed_data.management_number)
  management_number VARCHAR(100) NOT NULL UNIQUE,

  -- 2024년 매핑
  target_key_2024 VARCHAR(255),
  auto_suggested_2024 VARCHAR(255),
  auto_confidence_2024 NUMERIC(5,2) CHECK (auto_confidence_2024 BETWEEN 0 AND 100),
  auto_matching_reason_2024 JSONB,

  confirmed_2024 BOOLEAN DEFAULT FALSE,
  confirmed_by_2024 UUID REFERENCES user_profiles(id),
  confirmed_at_2024 TIMESTAMPTZ,

  modified_by_2024 UUID REFERENCES user_profiles(id),
  modified_at_2024 TIMESTAMPTZ,
  modification_note_2024 TEXT,

  -- 2025년 매핑
  target_key_2025 VARCHAR(255),
  auto_suggested_2025 VARCHAR(255),
  auto_confidence_2025 NUMERIC(5,2) CHECK (auto_confidence_2025 BETWEEN 0 AND 100),
  auto_matching_reason_2025 JSONB,

  confirmed_2025 BOOLEAN DEFAULT FALSE,
  confirmed_by_2025 UUID REFERENCES user_profiles(id),
  confirmed_at_2025 TIMESTAMPTZ,

  modified_by_2025 UUID REFERENCES user_profiles(id),
  modified_at_2025 TIMESTAMPTZ,
  modification_note_2025 TEXT,

  -- 시스템 필드
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_mgmt_group_target_2024 ON management_number_group_mapping(target_key_2024);
CREATE INDEX IF NOT EXISTS idx_mgmt_group_confirmed_2024 ON management_number_group_mapping(confirmed_2024);
CREATE INDEX IF NOT EXISTS idx_mgmt_group_target_2025 ON management_number_group_mapping(target_key_2025);

-- RLS
ALTER TABLE management_number_group_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mgmt_group_select_all" ON management_number_group_mapping;
CREATE POLICY "mgmt_group_select_all" ON management_number_group_mapping
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "mgmt_group_insert_auth" ON management_number_group_mapping;
CREATE POLICY "mgmt_group_insert_auth" ON management_number_group_mapping
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "mgmt_group_update_auth" ON management_number_group_mapping;
CREATE POLICY "mgmt_group_update_auth" ON management_number_group_mapping
  FOR UPDATE USING (
    confirmed_by_2024 = auth.uid()
    OR confirmed_by_2025 = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('master', 'emergency_center_admin', 'ministry_admin')
    )
  );

-- 코멘트
COMMENT ON TABLE management_number_group_mapping IS
  '관리번호 기반 그룹 매핑 (1 target_key → N management_numbers 지원)';
COMMENT ON COLUMN management_number_group_mapping.management_number IS
  'AED 관리번호 (여러 개가 같은 target_key 공유 가능)';

-- 완료 확인
SELECT 'management_number_group_mapping 테이블 생성 완료!' as status;
