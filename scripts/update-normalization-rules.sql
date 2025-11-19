-- TNMS normalization_rules 테이블 업데이트 스크립트
-- 실제 데이터 분석 결과 기반 (2025-11-19)
-- target_list_2025: 29,295건, aed_data: 82,104건 분석

-- 기존 규칙 비활성화 (필요시)
UPDATE normalization_rules
SET is_active = false
WHERE rule_type IN ('suffix_removal', 'pattern_removal', 'region_prefix_removal');

-- 1. 법인 표기 정규화 (최우선 - 대기업 중심 데이터 구조 반영)
INSERT INTO normalization_rules (
  rule_name,
  rule_type,
  rule_spec,
  priority,
  is_active,
  description
) VALUES (
  '법인표기 정규화',
  'pattern_removal',
  '{
    "pattern": "(주식회사|\\\\(주\\\\)|\\\\(유\\\\)|유한회사|\\\\(사\\\\)|사단법인|\\\\(재\\\\)|재단법인)",
    "replacement": ""
  }',
  150,
  true,
  '법인 표기를 제거하여 기관명 매칭 정확도 향상'
);

-- 2. 괄호와 내용 제거 (14.6% 데이터에 영향)
INSERT INTO normalization_rules (
  rule_name,
  rule_type,
  rule_spec,
  priority,
  is_active,
  description
) VALUES (
  '괄호 내용 제거',
  'pattern_removal',
  '{
    "pattern": "\\\\([^)]*\\\\)",
    "replacement": ""
  }',
  140,
  true,
  '괄호와 그 내용을 제거 (target_list 7.35%, aed_data 14.60% 영향)'
);

-- 3. 주요 기관 접미사 제거 (실제 빈도 순)
INSERT INTO normalization_rules (
  rule_name,
  rule_type,
  rule_spec,
  priority,
  is_active,
  description
) VALUES (
  '기관 접미사 제거',
  'suffix_removal',
  '{
    "patterns": [
      "병원", "소방서", "보건지소", "보건소", "공사",
      "센터", "의원", "경찰서", "의료원", "학교",
      "파출소", "공단", "면사무소", "읍사무소", "동사무소",
      "지구대", "대학", "주민센터", "행정복지센터"
    ]
  }',
  130,
  true,
  '빈도 높은 기관 접미사 제거 (실제 데이터 분석 기반)'
);

-- 4. 공백 정규화 (기본)
INSERT INTO normalization_rules (
  rule_name,
  rule_type,
  rule_spec,
  priority,
  is_active,
  description
) VALUES (
  '공백 정규화',
  'whitespace_normalize',
  '{}',
  120,
  true,
  '연속된 공백을 단일 공백으로 정규화'
);

-- 5. 특수문자 제거 (선택적)
INSERT INTO normalization_rules (
  rule_name,
  rule_type,
  rule_spec,
  priority,
  is_active,
  description
) VALUES (
  '특수문자 제거',
  'special_char_removal',
  '{
    "exclude_chars": ["-", "_", "/", "·"]
  }',
  110,
  true,
  '하이픈, 언더스코어, 슬래시, 가운뎃점은 유지하면서 기타 특수문자 제거'
);

-- 6. 지역 접두어 제거 (선택적 - 8% 데이터만 영향, 기본 비활성)
INSERT INTO normalization_rules (
  rule_name,
  rule_type,
  rule_spec,
  priority,
  is_active,
  description
) VALUES (
  '지역 접두어 제거 (선택적)',
  'region_prefix_removal',
  '{
    "prefixes": [
      "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
      "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
      "서울특별시", "부산광역시", "대구광역시", "인천광역시",
      "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
      "경기도", "강원도", "충청북도", "충청남도",
      "전라북도", "전라남도", "경상북도", "경상남도", "제주특별자치도"
    ]
  }',
  100,
  false,  -- 기본적으로 비활성화 (필요시 활성화)
  '지역명 접두어 제거 - 소방서 매칭 등 특수 케이스에만 사용 (target_list 6.3%, aed_data 8.6% 영향)'
);

-- 7. 한글 숫자 정규화 (기존 유지)
INSERT INTO normalization_rules (
  rule_name,
  rule_type,
  rule_spec,
  priority,
  is_active,
  description
) VALUES (
  '한글 숫자 정규화',
  'korean_numeral_normalize',
  '{}',
  90,
  true,
  '한글 숫자를 아라비아 숫자로 변환'
);

-- 규칙 적용 순서 확인
SELECT
  rule_id,
  rule_name,
  rule_type,
  priority,
  is_active,
  description
FROM normalization_rules
WHERE is_active = true
ORDER BY priority DESC;

-- 통계 정보 (참고용)
-- target_list_2025 접미사 분포:
--   기타: 21,458건 (73.3%)
--   병원: 2,445건, 소방서: 2,031건, 보건지소: 1,328건, 보건소: 628건
-- aed_data 접미사 분포:
--   기타: 56,522건 (68.9%)
--   학교: 7,686건, 센터: 6,341건, 병원: 3,524건, 소방서: 1,914건
-- 괄호 포함 비율:
--   target_list: 7.35%, aed_data: 14.60%
-- 지역 접두어 사용:
--   target_list: 1,835건 (6.3%), aed_data: 7,039건 (8.6%)