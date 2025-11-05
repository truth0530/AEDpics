-- ============================================
-- Migration 06: AED 점검 시스템 스키마 수정
-- 실행일: 2025-09-13
-- 목적: equipment_serial 기반으로 점검 시스템 재설계
-- 기반: 실제 aed_data 테이블 (80,766개 레코드)
-- ============================================

-- ============================================
-- 1. 기존 잘못된 테이블 정리
-- ============================================
DROP TABLE IF EXISTS public.inspections CASCADE;
DROP TABLE IF EXISTS public.aed_devices CASCADE;

-- ============================================
-- 2. aed_data 테이블에 필수 제약조건 추가
-- ============================================

-- equipment_serial 유니크 제약조건 (이미 있다면 무시)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uk_aed_data_equipment_serial'
    ) THEN
        ALTER TABLE aed_data
        ADD CONSTRAINT uk_aed_data_equipment_serial
        UNIQUE (equipment_serial);
    END IF;
END $$;

-- 필수 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_aed_data_equipment_serial
    ON aed_data(equipment_serial);

CREATE INDEX IF NOT EXISTS idx_aed_data_sido_manufacturer
    ON aed_data(sido, manufacturer);

CREATE INDEX IF NOT EXISTS idx_aed_data_expiry_dates
    ON aed_data(battery_expiry_date, patch_expiry_date);

-- ============================================
-- 3. 점검 기록 테이블 (equipment_serial 기반)
-- ============================================
CREATE TABLE IF NOT EXISTS public.aed_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 🔑 AED 장치 참조 (equipment_serial 기반)
    equipment_serial VARCHAR(255) NOT NULL,

    -- 점검 메타데이터
    inspector_id UUID REFERENCES user_profiles(id),
    inspector_name VARCHAR(100),
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    inspection_type TEXT DEFAULT 'monthly' CHECK (
        inspection_type IN ('monthly', 'emergency', 'installation', 'annual', 'special', 'routine', 'maintenance')
    ),
    inspection_duration_minutes INTEGER,

    -- 📋 점검 시점의 실제 확인된 정보 (aed_data와 다를 수 있음)
    confirmed_manufacturer VARCHAR(255),
    confirmed_model_name VARCHAR(255),
    confirmed_serial_number VARCHAR(255),
    confirmed_location TEXT,
    confirmed_installation_position TEXT,

    -- 🔍 점검 결과 - 배터리
    battery_status VARCHAR(50) NOT NULL DEFAULT 'not_checked' CHECK (
        battery_status IN ('normal', 'warning', 'expired', 'missing', 'damaged', 'not_checked')
    ),
    battery_expiry_checked DATE,
    battery_level_percentage INTEGER CHECK (battery_level_percentage BETWEEN 0 AND 100),
    battery_visual_condition VARCHAR(50) DEFAULT 'good' CHECK (
        battery_visual_condition IN ('good', 'swollen', 'corroded', 'damaged')
    ),

    -- 🔍 점검 결과 - 패드/패치
    pad_status VARCHAR(50) NOT NULL DEFAULT 'not_checked' CHECK (
        pad_status IN ('normal', 'warning', 'expired', 'missing', 'damaged', 'not_checked')
    ),
    pad_expiry_checked DATE,
    pad_package_intact BOOLEAN DEFAULT true,
    pad_expiry_readable BOOLEAN DEFAULT true,

    -- 🔍 점검 결과 - 장치 상태
    device_status VARCHAR(50) NOT NULL DEFAULT 'not_checked' CHECK (
        device_status IN ('normal', 'warning', 'malfunction', 'damaged', 'not_checked')
    ),
    indicator_status VARCHAR(50) DEFAULT 'not_checked' CHECK (
        indicator_status IN ('green', 'red', 'blinking', 'off', 'not_checked')
    ),
    device_expiry_checked DATE,

    -- 🔍 설치 환경 점검
    location_appropriate BOOLEAN,
    signage_visible BOOLEAN,
    accessibility_clear BOOLEAN,
    temperature_appropriate BOOLEAN,

    -- 📊 종합 점검 결과
    overall_status VARCHAR(50) DEFAULT 'pending' CHECK (
        overall_status IN ('pass', 'fail', 'pending', 'partial', 'requires_attention')
    ),
    priority_level VARCHAR(20) DEFAULT 'normal' CHECK (
        priority_level IN ('critical', 'urgent', 'high', 'medium', 'normal', 'low')
    ),

    -- 📝 점검 상세 내역
    issues_found TEXT,
    action_taken TEXT,
    recommendations TEXT,
    requires_replacement BOOLEAN DEFAULT false,
    replacement_parts TEXT[],

    -- 🗄️ 증빙 자료
    photo_urls TEXT[],
    signature_data TEXT,
    notes TEXT,

    -- ✅ 승인 및 확인
    confirmed_by UUID REFERENCES user_profiles(id),
    confirmed_at TIMESTAMPTZ,
    review_status VARCHAR(20) DEFAULT 'pending' CHECK (
        review_status IN ('pending', 'approved', 'rejected', 'requires_revision')
    ),

    -- 시스템 필드
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- 외래키 제약조건 (equipment_serial 기반)
    CONSTRAINT fk_aed_inspections_equipment
        FOREIGN KEY (equipment_serial)
        REFERENCES aed_data(equipment_serial)
        ON DELETE RESTRICT  -- 점검 기록 보호
);

-- ============================================
-- 4. 인덱스 생성 (성능 최적화)
-- ============================================

-- 주요 조회 패턴 인덱스
CREATE INDEX idx_aed_inspections_equipment_serial
    ON aed_inspections(equipment_serial);

CREATE INDEX idx_aed_inspections_equipment_date
    ON aed_inspections(equipment_serial, inspection_date DESC);

CREATE INDEX idx_aed_inspections_date_status
    ON aed_inspections(inspection_date DESC, overall_status);

CREATE INDEX idx_aed_inspections_inspector_date
    ON aed_inspections(inspector_id, inspection_date DESC);

CREATE INDEX idx_aed_inspections_priority_status
    ON aed_inspections(priority_level, overall_status, inspection_date DESC);

-- ============================================
-- 5. 업데이트 트리거
-- ============================================
CREATE TRIGGER update_aed_inspections_updated_at
    BEFORE UPDATE ON public.aed_inspections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. RLS 정책 설정
-- ============================================
ALTER TABLE aed_inspections ENABLE ROW LEVEL SECURITY;

-- 점검자 본인 기록 모든 권한
CREATE POLICY "inspections_own_records" ON aed_inspections
    FOR ALL USING (
        inspector_id = auth.uid()
    );

-- 같은 조직 사용자들 조회 권한
CREATE POLICY "inspections_same_org_read" ON aed_inspections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up1
            JOIN user_profiles up2 ON up1.organization_id = up2.organization_id
            WHERE up1.id = auth.uid()
            AND up2.id = aed_inspections.inspector_id
        )
    );

-- 관리자 모든 권한
CREATE POLICY "inspections_admin_all" ON aed_inspections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('master', 'emergency_center_admin', 'regional_admin')
            AND user_profiles.is_active = true
        )
    );

-- 승인자 검토 권한
CREATE POLICY "inspections_approver_review" ON aed_inspections
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.can_approve_users = true
            AND user_profiles.is_active = true
        )
    );

-- ============================================
-- 7. 점검 상태 통합 뷰
-- ============================================

-- 최신 점검 상태 뷰
CREATE OR REPLACE VIEW inspection_status AS
SELECT
    a.*,
    -- 최신 점검 정보
    latest.id as latest_inspection_id,
    COALESCE(latest.inspection_date, '1900-01-01'::date) as last_inspection_date,
    COALESCE(latest.overall_status, 'never_inspected') as inspection_status,
    COALESCE(latest.priority_level, 'normal') as current_priority,
    latest.inspector_name as last_inspector,
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
        id, equipment_serial, inspection_date, overall_status,
        priority_level, inspector_name, issues_found
    FROM inspections
    WHERE equipment_serial = a.equipment_serial
    ORDER BY inspection_date DESC, created_at DESC
    LIMIT 1
) latest ON true;

-- 보건소별 점검 현황 뷰
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

-- ============================================
-- 8. 데이터 검증 함수들
-- ============================================

-- 고아 점검 기록 확인 함수
CREATE OR REPLACE FUNCTION check_orphaned_inspections()
RETURNS TABLE(
    inspection_id UUID,
    equipment_serial VARCHAR,
    inspection_date DATE,
    inspector_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.equipment_serial,
        i.inspection_date,
        i.inspector_name
    FROM aed_inspections i
    LEFT JOIN aed_data a ON i.equipment_serial = a.equipment_serial
    WHERE a.equipment_serial IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 점검 통계 함수
CREATE OR REPLACE FUNCTION get_inspection_stats(
    target_sido VARCHAR DEFAULT NULL,
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_devices', COUNT(DISTINCT a.equipment_serial),
        'inspected_devices', COUNT(DISTINCT CASE WHEN i.equipment_serial IS NOT NULL THEN a.equipment_serial END),
        'total_inspections', COUNT(i.id),
        'completion_rate', ROUND(
            100.0 * COUNT(DISTINCT CASE WHEN i.equipment_serial IS NOT NULL THEN a.equipment_serial END) /
            NULLIF(COUNT(DISTINCT a.equipment_serial), 0), 2
        ),
        'avg_priority_score', ROUND(AVG(
            CASE
                WHEN latest.inspection_date IS NULL THEN 100
                WHEN latest.overall_status = 'fail' THEN 90
                WHEN latest.inspection_date < CURRENT_DATE - INTERVAL '60 days' THEN 80
                ELSE 10
            END
        ), 1),
        'by_status', json_build_object(
            'pass', COUNT(CASE WHEN i.overall_status = 'pass' THEN 1 END),
            'fail', COUNT(CASE WHEN i.overall_status = 'fail' THEN 1 END),
            'pending', COUNT(CASE WHEN i.overall_status = 'pending' THEN 1 END),
            'requires_attention', COUNT(CASE WHEN i.overall_status = 'requires_attention' THEN 1 END)
        )
    ) INTO result
    FROM aed_data a
    LEFT JOIN aed_inspections i ON a.equipment_serial = i.equipment_serial
        AND i.inspection_date BETWEEN start_date AND end_date
    LEFT JOIN LATERAL (
        SELECT inspection_date, overall_status
        FROM aed_inspections
        WHERE equipment_serial = a.equipment_serial
        ORDER BY inspection_date DESC
        LIMIT 1
    ) latest ON true
    WHERE (target_sido IS NULL OR a.sido = target_sido);

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. 코멘트 추가
-- ============================================

COMMENT ON TABLE aed_inspections IS '실제 AED 점검 기록 테이블 - equipment_serial 기반 연계';
COMMENT ON COLUMN aed_inspections.equipment_serial IS 'aed_data 테이블의 equipment_serial과 연계되는 외래키';
COMMENT ON VIEW inspection_status IS 'AED별 최신 점검 상태 및 우선순위 통합 뷰';
COMMENT ON VIEW health_center_inspection_summary IS '보건소별 점검 현황 요약 뷰';

-- ============================================
-- 완료 로그
-- ============================================
INSERT INTO public.schema_migrations (version, applied_at)
VALUES ('06_fix_inspection_schema', NOW())
ON CONFLICT (version) DO NOTHING;