-- =====================================================
-- Migration 52: inspection_status 뷰 재생성
-- 목적: inspections 테이블 이름 변경에 맞춰 뷰 재생성
-- 작성일: 2025-10-05
-- =====================================================

-- 주의: Migration 51에서 aed_inspections_v2 → inspections로 이름 변경됨

-- 1. inspection_status 뷰 재생성 (실제 inspections 스키마에 맞춤)
CREATE OR REPLACE VIEW inspection_status AS
SELECT
    a.*,
    -- 최신 점검 정보
    latest.id as latest_inspection_id,
    COALESCE(latest.inspection_date, '1900-01-01'::date) as latest_inspection_date,
    COALESCE(latest.overall_status, 'never_inspected') as inspection_status,
    latest.inspector_id as last_inspector_id,
    latest.issues_found,

    -- 점검 필요성 계산
    CASE
        WHEN latest.inspection_date IS NULL THEN 'never_inspected'
        WHEN latest.inspection_date < CURRENT_DATE - INTERVAL '60 days' THEN 'overdue'
        WHEN latest.inspection_date < CURRENT_DATE - INTERVAL '30 days' THEN 'due_soon'
        WHEN latest.overall_status = 'fail' THEN 'failed_last'
        WHEN latest.overall_status = 'requires_attention' THEN 'requires_attention'
        ELSE 'current'
    END as inspection_priority,

    -- 유효기간 상태
    CASE
        WHEN a.battery_expiry_date < CURRENT_DATE OR a.patch_expiry_date < CURRENT_DATE THEN 'expired'
        WHEN a.battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
             a.patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
        ELSE 'valid'
    END as expiry_status,

    -- 종합 상태 점수 (우선순위 계산용)
    CASE
        WHEN latest.inspection_date IS NULL THEN 100
        WHEN latest.overall_status = 'fail' THEN 90
        WHEN a.battery_expiry_date < CURRENT_DATE OR a.patch_expiry_date < CURRENT_DATE THEN 85
        WHEN latest.inspection_date < CURRENT_DATE - INTERVAL '60 days' THEN 80
        WHEN latest.overall_status = 'requires_attention' THEN 70
        WHEN a.battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
             a.patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 60
        WHEN latest.inspection_date < CURRENT_DATE - INTERVAL '30 days' THEN 50
        ELSE 10
    END as priority_score

FROM aed_data a
LEFT JOIN LATERAL (
    SELECT
        id,
        equipment_serial,
        inspection_date,
        overall_status,
        inspector_id,
        issues_found
    FROM inspections
    WHERE equipment_serial = a.equipment_serial
    ORDER BY inspection_date DESC, created_at DESC
    LIMIT 1
) latest ON true;

-- 2. health_center_inspection_summary 뷰 재생성
CREATE OR REPLACE VIEW health_center_inspection_summary AS
SELECT
    jurisdiction_health_center as health_center_name,
    sido,
    COUNT(*) AS total_devices,

    -- 점검 현황
    COUNT(CASE WHEN inspection_priority = 'current' THEN 1 END) AS up_to_date,
    COUNT(CASE WHEN inspection_priority = 'due_soon' THEN 1 END) AS due_soon,
    COUNT(CASE WHEN inspection_priority = 'overdue' THEN 1 END) AS overdue,
    COUNT(CASE WHEN inspection_priority = 'never_inspected' THEN 1 END) AS never_inspected,
    COUNT(CASE WHEN inspection_priority = 'failed_last' THEN 1 END) AS failed_last,

    -- 유효기간 현황
    COUNT(CASE WHEN expiry_status = 'valid' THEN 1 END) AS valid_expiry,
    COUNT(CASE WHEN expiry_status = 'expiring_soon' THEN 1 END) AS expiring_soon,
    COUNT(CASE WHEN expiry_status = 'expired' THEN 1 END) AS expired,

    -- 완료율 계산
    ROUND(
        100.0 * COUNT(CASE WHEN inspection_priority = 'current' THEN 1 END) /
        NULLIF(COUNT(*), 0),
        2
    ) AS completion_rate,

    -- 평균 우선순위 점수
    ROUND(AVG(priority_score), 1) AS avg_priority_score

FROM inspection_status
WHERE jurisdiction_health_center IS NOT NULL
GROUP BY jurisdiction_health_center, sido
ORDER BY avg_priority_score DESC, completion_rate ASC;

-- 3. 코멘트 업데이트
COMMENT ON VIEW inspection_status IS 'AED별 최신 점검 상태 및 우선순위 통합 뷰 (inspections 테이블 참조)';
COMMENT ON VIEW health_center_inspection_summary IS '보건소별 점검 현황 요약 뷰';

-- 4. 권한 설정
GRANT SELECT ON inspection_status TO authenticated;
GRANT SELECT ON health_center_inspection_summary TO authenticated;

-- =====================================================
-- Migration 완료
-- =====================================================
