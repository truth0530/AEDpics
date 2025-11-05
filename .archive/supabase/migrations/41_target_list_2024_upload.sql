-- ============================================
-- Migration 41: target_list_2024 테이블 생성 및 데이터 업로드
-- 실행일: 2025-10-04
-- 목적: 2024년 구비의무기관 리스트 관리
-- ============================================

-- ============================================
-- 1. target_list_2024 테이블 생성
-- ============================================
DROP TABLE IF EXISTS public.target_list_2024 CASCADE;

CREATE TABLE public.target_list_2024 (
  -- 자동생성 키 (target_keygroup + 순번)
  target_key VARCHAR(255) PRIMARY KEY,

  -- 엑셀 원본 데이터
  no INTEGER,
  sido VARCHAR(50) NOT NULL,
  gugun VARCHAR(100) NOT NULL,
  division VARCHAR(100),          -- '구분' 컬럼
  sub_division VARCHAR(100),      -- '상세구분' 컬럼
  institution_name VARCHAR(255) NOT NULL,
  target_keygroup VARCHAR(255) NOT NULL,

  -- 매칭된 management_number (초기 NULL)
  management_number VARCHAR(100),

  -- 메타데이터
  data_year INTEGER DEFAULT 2024,
  imported_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_target_2024_keygroup ON target_list_2024(target_keygroup);
CREATE INDEX idx_target_2024_location ON target_list_2024(sido, gugun);
CREATE INDEX idx_target_2024_mgmt_num ON target_list_2024(management_number);
CREATE INDEX idx_target_2024_division ON target_list_2024(division, sub_division);

-- 트리거
CREATE TRIGGER update_target_list_2024_updated_at
  BEFORE UPDATE ON public.target_list_2024
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 코멘트
COMMENT ON TABLE target_list_2024 IS '2024년 AED 구비의무기관 리스트';
COMMENT ON COLUMN target_list_2024.target_key IS '자동생성 고유키 (target_keygroup + 순번)';
COMMENT ON COLUMN target_list_2024.target_keygroup IS '그룹 키 (시도_구군_상세구분)';
COMMENT ON COLUMN target_list_2024.management_number IS 'aed_data.management_number와 매칭됨';

-- ============================================
-- 2. 임시 테이블 생성 (CSV 업로드용)
-- ============================================
DROP TABLE IF EXISTS temp_target_import_2024;

CREATE TEMP TABLE temp_target_import_2024 (
  no INTEGER,
  sido VARCHAR(50),
  gugun VARCHAR(100),
  division VARCHAR(100),
  sub_division VARCHAR(100),
  institution_name VARCHAR(255),
  target_keygroup VARCHAR(255),
  target_key_placeholder TEXT,           -- CSV의 빈 컬럼
  management_number_placeholder TEXT     -- CSV의 빈 컬럼
);

\echo '==============================================='
\echo '임시 테이블 생성 완료'
\echo '==============================================='
\echo ''
\echo '다음 단계:'
\echo '1. Supabase Dashboard > SQL Editor로 이동'
\echo '2. 아래 명령어로 CSV 파일 업로드:'
\echo ''
\echo "   \COPY temp_target_import_2024(no, sido, gugun, division, sub_division, institution_name, target_keygroup, target_key_placeholder, management_number_placeholder) FROM '/path/to/target_list_2024.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');"
\echo ''
\echo '3. 또는 Supabase Dashboard에서 CSV 파일을 직접 temp_target_import_2024 테이블로 업로드'
\echo ''
\echo '4. 업로드 완료 후 아래 스크립트 실행:'
\echo '   - 42_target_key_generation.sql'
\echo ''
\echo '==============================================='
