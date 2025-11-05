-- Expiry Date Filter Functions
-- 만료일 필터링을 DB 레벨에서 처리하기 위한 함수들

-- 1. 만료 상태 체크 함수 (배터리, 패치 등)
CREATE OR REPLACE FUNCTION check_expiry_status(
  p_expiry_date DATE,
  p_filter_type TEXT,
  p_today DATE DEFAULT CURRENT_DATE
) RETURNS BOOLEAN AS $$
BEGIN
  -- NULL 값 처리
  IF p_expiry_date IS NULL THEN
    RETURN FALSE;
  END IF;

  CASE p_filter_type
    WHEN 'expired' THEN
      -- 만료됨 (오늘 이전)
      RETURN p_expiry_date < p_today;

    WHEN 'expiring_soon' THEN
      -- 만료 예정 (오늘 ~ 30일 이내)
      RETURN p_expiry_date >= p_today
         AND p_expiry_date <= p_today + INTERVAL '30 days';

    WHEN 'normal' THEN
      -- 정상 (30일 이후)
      RETURN p_expiry_date > p_today + INTERVAL '30 days';

    WHEN 'all' THEN
      -- 모두 포함
      RETURN TRUE;

    ELSE
      -- 알 수 없는 필터 타입
      RETURN TRUE;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. 점검 이력 상태 체크 함수
CREATE OR REPLACE FUNCTION check_inspection_status(
  p_last_inspection_date DATE,
  p_filter_type TEXT,
  p_today DATE DEFAULT CURRENT_DATE
) RETURNS BOOLEAN AS $$
BEGIN
  -- NULL 값 처리 (점검 이력 없음)
  IF p_last_inspection_date IS NULL THEN
    CASE p_filter_type
      WHEN 'never_inspected' THEN
        RETURN TRUE;
      ELSE
        RETURN FALSE;
    END CASE;
  END IF;

  CASE p_filter_type
    WHEN 'overdue' THEN
      -- 점검 기한 초과 (1년 이상 미점검)
      RETURN p_last_inspection_date < p_today - INTERVAL '365 days';

    WHEN 'due_soon' THEN
      -- 점검 필요 (6개월 ~ 1년)
      RETURN p_last_inspection_date >= p_today - INTERVAL '365 days'
         AND p_last_inspection_date < p_today - INTERVAL '180 days';

    WHEN 'recent' THEN
      -- 최근 점검됨 (6개월 이내)
      RETURN p_last_inspection_date >= p_today - INTERVAL '180 days';

    WHEN 'never_inspected' THEN
      -- 점검 이력 없음 (이미 NULL 체크 완료)
      RETURN FALSE;

    WHEN 'all' THEN
      -- 모두 포함
      RETURN TRUE;

    ELSE
      -- 알 수 없는 필터 타입
      RETURN TRUE;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. 교체 예정일 체크 함수
CREATE OR REPLACE FUNCTION check_replacement_status(
  p_replacement_date DATE,
  p_filter_type TEXT,
  p_today DATE DEFAULT CURRENT_DATE
) RETURNS BOOLEAN AS $$
BEGIN
  -- NULL 값 처리
  IF p_replacement_date IS NULL THEN
    RETURN FALSE;
  END IF;

  CASE p_filter_type
    WHEN 'overdue' THEN
      -- 교체 기한 초과
      RETURN p_replacement_date < p_today;

    WHEN 'due_soon' THEN
      -- 교체 예정 (오늘 ~ 60일 이내)
      RETURN p_replacement_date >= p_today
         AND p_replacement_date <= p_today + INTERVAL '60 days';

    WHEN 'scheduled' THEN
      -- 교체 예정 (60일 이후)
      RETURN p_replacement_date > p_today + INTERVAL '60 days';

    WHEN 'all' THEN
      -- 모두 포함
      RETURN TRUE;

    ELSE
      -- 알 수 없는 필터 타입
      RETURN TRUE;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION check_expiry_status TO authenticated;
GRANT EXECUTE ON FUNCTION check_inspection_status TO authenticated;
GRANT EXECUTE ON FUNCTION check_replacement_status TO authenticated;

-- 5. 함수에 대한 코멘트
COMMENT ON FUNCTION check_expiry_status IS '만료일 필터링 (배터리, 패치 등) - expired/expiring_soon/normal';
COMMENT ON FUNCTION check_inspection_status IS '점검 이력 필터링 - overdue/due_soon/recent/never_inspected';
COMMENT ON FUNCTION check_replacement_status IS '교체 예정일 필터링 - overdue/due_soon/scheduled';

-- 6. 성능을 위한 함수 기반 인덱스 생성
-- 만료 예정 배터리 빠른 조회
CREATE INDEX IF NOT EXISTS idx_aed_data_battery_expiring_soon
ON aed_data (battery_expiry_date)
WHERE battery_expiry_date >= CURRENT_DATE
  AND battery_expiry_date <= CURRENT_DATE + INTERVAL '30 days';

-- 만료된 배터리 빠른 조회
CREATE INDEX IF NOT EXISTS idx_aed_data_battery_expired
ON aed_data (battery_expiry_date)
WHERE battery_expiry_date < CURRENT_DATE;

-- 만료 예정 패치 빠른 조회
CREATE INDEX IF NOT EXISTS idx_aed_data_patch_expiring_soon
ON aed_data (patch_expiry_date)
WHERE patch_expiry_date >= CURRENT_DATE
  AND patch_expiry_date <= CURRENT_DATE + INTERVAL '30 days';

-- 만료된 패치 빠른 조회
CREATE INDEX IF NOT EXISTS idx_aed_data_patch_expired
ON aed_data (patch_expiry_date)
WHERE patch_expiry_date < CURRENT_DATE;

-- 점검 기한 초과 빠른 조회
CREATE INDEX IF NOT EXISTS idx_aed_data_inspection_overdue
ON aed_data (last_inspection_date)
WHERE last_inspection_date < CURRENT_DATE - INTERVAL '365 days'
   OR last_inspection_date IS NULL;

-- 인덱스 통계 업데이트
ANALYZE aed_data;

-- 인덱스 코멘트
COMMENT ON INDEX idx_aed_data_battery_expiring_soon IS '만료 예정 배터리 (30일 이내)';
COMMENT ON INDEX idx_aed_data_battery_expired IS '만료된 배터리';
COMMENT ON INDEX idx_aed_data_patch_expiring_soon IS '만료 예정 패치 (30일 이내)';
COMMENT ON INDEX idx_aed_data_patch_expired IS '만료된 패치';
COMMENT ON INDEX idx_aed_data_inspection_overdue IS '점검 기한 초과 또는 미점검';
