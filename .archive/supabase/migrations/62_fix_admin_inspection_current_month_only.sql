-- Migration 62: 관리자점검 기준을 90일에서 당월만으로 변경
-- 작성일: 2025-10-14
-- 목적:
--   1. 관리자점검(completed_count)을 90일 기준에서 당월(current month)만 인정하도록 변경
--   2. 외부표출 차단 장비의 점검 상태 필드 추가 (blocked_inspected_count 등)
--   3. 긴급장비(urgent) 기준도 당월 미점검으로 변경

CREATE OR REPLACE FUNCTION get_dashboard_stats_by_region()
RETURNS TABLE (
  region VARCHAR,
  total_count BIGINT,
  mandatory_count BIGINT,
  non_mandatory_count BIGINT,
  completed_count BIGINT,
  completed_mandatory_count BIGINT,
  completed_non_mandatory_count BIGINT,
  urgent_count BIGINT,
  completion_rate NUMERIC,
  blocked_count BIGINT,
  blocked_mandatory_count BIGINT,
  blocked_non_mandatory_count BIGINT,
  blocked_inspected_count BIGINT,
  blocked_inspected_mandatory_count BIGINT,
  blocked_inspected_non_mandatory_count BIGINT,
  uninspected_count BIGINT,
  uninspected_mandatory_count BIGINT,
  uninspected_non_mandatory_count BIGINT,
  field_inspected_count BIGINT,
  field_inspected_mandatory_count BIGINT,
  field_inspected_non_mandatory_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COALESCE(a.sido, '미분류')::VARCHAR AS region,
    COUNT(*)::BIGINT AS total_count,
    COUNT(*) FILTER (WHERE a.category_1 = '구비의무기관')::BIGINT AS mandatory_count,
    COUNT(*) FILTER (WHERE a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)::BIGINT AS non_mandatory_count,

    -- 관리자점검: 당월 점검만 인정 (90일 기준 제거)
    COUNT(*) FILTER (WHERE DATE_TRUNC('month', a.last_inspection_date) = DATE_TRUNC('month', CURRENT_DATE))::BIGINT AS completed_count,
    COUNT(*) FILTER (WHERE DATE_TRUNC('month', a.last_inspection_date) = DATE_TRUNC('month', CURRENT_DATE) AND a.category_1 = '구비의무기관')::BIGINT AS completed_mandatory_count,
    COUNT(*) FILTER (WHERE DATE_TRUNC('month', a.last_inspection_date) = DATE_TRUNC('month', CURRENT_DATE) AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL))::BIGINT AS completed_non_mandatory_count,

    -- 긴급: 당월 미점검 or 배터리/패치 만료 임박
    COUNT(*) FILTER (WHERE
      a.battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      a.patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
      DATE_TRUNC('month', a.last_inspection_date) < DATE_TRUNC('month', CURRENT_DATE) OR
      a.last_inspection_date IS NULL
    )::BIGINT AS urgent_count,

    -- 완료율: 당월 점검 기준
    ROUND(
      (COUNT(*) FILTER (WHERE DATE_TRUNC('month', a.last_inspection_date) = DATE_TRUNC('month', CURRENT_DATE))::NUMERIC /
       NULLIF(COUNT(*)::NUMERIC, 0)) * 100,
      1
    ) AS completion_rate,

    -- 외부표출 차단 장비 (구비의무기관 차량 제외)
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
    )::BIGINT AS blocked_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND a.category_1 = '구비의무기관'
    )::BIGINT AS blocked_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)
    )::BIGINT AS blocked_non_mandatory_count,

    -- 외부표출 차단 중 당월 점검 완료 (NEW 필드)
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND DATE_TRUNC('month', a.last_inspection_date) = DATE_TRUNC('month', CURRENT_DATE)
    )::BIGINT AS blocked_inspected_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND DATE_TRUNC('month', a.last_inspection_date) = DATE_TRUNC('month', CURRENT_DATE)
      AND a.category_1 = '구비의무기관'
    )::BIGINT AS blocked_inspected_mandatory_count,
    COUNT(*) FILTER (WHERE
      a.external_display = 'N'
      AND a.external_non_display_reason IS NOT NULL
      AND a.external_non_display_reason != ''
      AND a.external_non_display_reason NOT LIKE '%구비의무기관(119구급차, 여객, 항공기, 객차(철도), 선박%'
      AND DATE_TRUNC('month', a.last_inspection_date) = DATE_TRUNC('month', CURRENT_DATE)
      AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL)
    )::BIGINT AS blocked_inspected_non_mandatory_count,

    -- 미점검 장비 (점검 이력 없음, 별개 개념)
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL)::BIGINT AS uninspected_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL AND a.category_1 = '구비의무기관')::BIGINT AS uninspected_mandatory_count,
    COUNT(*) FILTER (WHERE a.last_inspection_date IS NULL AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL))::BIGINT AS uninspected_non_mandatory_count,

    -- 현장점검 완료 (inspection_sessions의 completed 상태)
    COUNT(*) FILTER (WHERE s.status = 'completed')::BIGINT AS field_inspected_count,
    COUNT(*) FILTER (WHERE s.status = 'completed' AND a.category_1 = '구비의무기관')::BIGINT AS field_inspected_mandatory_count,
    COUNT(*) FILTER (WHERE s.status = 'completed' AND (a.category_1 = '구비의무기관 외' OR a.category_1 IS NULL))::BIGINT AS field_inspected_non_mandatory_count

  FROM aed_data a
  LEFT JOIN inspection_sessions s ON a.equipment_serial = s.equipment_serial
  GROUP BY a.sido
  ORDER BY total_count DESC
$$;

-- 함수 설명 추가
COMMENT ON FUNCTION get_dashboard_stats_by_region() IS '
시도별 AED 점검 현황 통계 (당월 점검 기준)
- completed_count: 이번 달 점검한 장비 수 (last_inspection_date가 당월인 경우)
- urgent_count: 당월 미점검 또는 배터리/패치 만료 임박
- blocked_inspected_count: 외부표출 차단 장비 중 당월 점검 완료
- uninspected_count: 점검 이력이 전혀 없는 장비 (별개 개념)
- 업데이트: 2025-10-14
';
