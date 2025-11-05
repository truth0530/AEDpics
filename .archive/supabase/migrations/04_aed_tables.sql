-- ============================================
-- Migration 04: AED 관련 테이블 생성
-- 실행일: 2025-09-10
-- 목적: AED 장치 및 점검 기록 테이블 생성
-- 기반: 인트라넷 e-gen 실제 데이터 스키마
-- ============================================

-- ============================================
-- 1. AED 장치 테이블 (실제 e-gen 필드 기반)
-- ============================================
CREATE TABLE IF NOT EXISTS public.aed_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 기본 식별 정보
    management_number TEXT UNIQUE NOT NULL,  -- 관리번호
    equipment_number TEXT,                   -- 장비연번
    
    -- 제조 정보
    model_name TEXT,                         -- 모델명
    manufacturer TEXT,                       -- 제조사
    manufacturing_country TEXT,              -- 제조국
    manufacturing_date DATE,                 -- 제조일
    serial_number TEXT,                      -- 제조번호
    
    -- 설치 정보
    installation_date DATE,                  -- 설치일자
    first_installation_date DATE,            -- 최초설치일
    installation_institution TEXT NOT NULL,  -- 설치기관명
    installation_institution_address TEXT,   -- 설치기관 주소
    installation_location_address TEXT,      -- 설치장소 주소
    installation_location TEXT NOT NULL,     -- 설치위치
    installation_method TEXT,                -- 설치방법
    
    -- 관리 정보
    health_center_id UUID REFERENCES organizations(id),  -- 관할보건소 (참조)
    health_center_name TEXT,                 -- 관할보건소명 (텍스트)
    manager_name TEXT,                       -- 관리책임자
    institution_contact TEXT,                -- 기관 연락처
    founder TEXT,                            -- 개설자
    purchasing_institution TEXT,             -- 구매기관
    
    -- 위치 정보
    province TEXT NOT NULL,                  -- 시/도
    district TEXT NOT NULL,                  -- 구/군
    longitude DECIMAL(11, 8),                -- 경도
    latitude DECIMAL(10, 8),                 -- 위도
    
    -- 상태 정보
    operation_status TEXT,                   -- 운영상태
    display_permission BOOLEAN DEFAULT true, -- 표출허용여부
    external_display BOOLEAN DEFAULT true,   -- 외부표출여부
    external_nondisplay_reason TEXT,         -- 외부미표출사유
    government_support BOOLEAN DEFAULT false,-- 국고지원여부
    
    -- 유효기간 관리 (패드는 성인/소아 구분 없음)
    battery_expiry_date DATE,                -- 배터리 유효기간
    pad_existence BOOLEAN,                   -- 패치 유/무
    pad_expiry_date DATE,                    -- 패치 유효기간
    
    -- 점검 정보
    last_inspection_date DATE,               -- 최근점검일
    last_usage_date DATE,                    -- 최근사용일
    replacement_schedule_date DATE,          -- 교체 예정일
    
    -- 분류 정보
    category1 TEXT,                          -- 분류1
    category2 TEXT,                          -- 분류2
    category3 TEXT,                          -- 분류3
    
    -- 기타
    report_date DATE,                        -- 신고일자
    registration_date DATE,                  -- 등록일자
    remarks TEXT,                            -- 비고
    saeol_deleted BOOLEAN DEFAULT false,     -- 새올 삭제여부
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 점검 기록 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS public.inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES aed_devices(id) ON DELETE CASCADE,
    inspector_id UUID REFERENCES user_profiles(id),
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    inspection_type TEXT DEFAULT 'monthly' CHECK (
        inspection_type IN ('monthly', 'emergency', 'installation', 'annual', 'special')
    ),
    
    -- 점검 항목 (실제 데이터 기반 - 패드는 구분 없음)
    device_status TEXT DEFAULT 'not_checked',
    battery_status TEXT DEFAULT 'not_checked',
    pad_status TEXT DEFAULT 'not_checked',  -- 패드 상태 (성인/소아 구분 없음)
    indicator_status TEXT DEFAULT 'not_checked',
    location_appropriate BOOLEAN,
    signage_visible BOOLEAN,
    
    -- 유효기간 확인 (점검 시 실제 확인 값)
    battery_expiry_checked DATE,             -- 점검 시 확인한 배터리 유효기간
    pad_expiry_checked DATE,                 -- 점검 시 확인한 패드 유효기간
    
    -- 점검 시 운영상태 확인
    operation_status_checked TEXT,           -- 점검 시 확인한 운영상태
    actual_location TEXT,                    -- 실제 설치 위치 (변경된 경우)
    location_changed BOOLEAN DEFAULT false,  -- 위치 변경 여부
    
    -- 사용 이력 확인
    usage_count INTEGER DEFAULT 0,           -- 점검 시점까지 사용 횟수
    last_usage_date_checked DATE,            -- 점검 시 확인한 최근 사용일
    
    -- 점검 결과
    overall_status TEXT DEFAULT 'pending' CHECK (
        overall_status IN ('pass', 'fail', 'pending', 'partial')
    ),
    issues_found TEXT,
    action_taken TEXT,
    requires_replacement BOOLEAN DEFAULT false,  -- 교체 필요 여부
    replacement_parts TEXT[],                    -- 교체 필요 부품 목록
    
    -- 증빙 자료
    photo_urls TEXT[],
    signature_data TEXT,
    
    -- 확인/승인
    confirmed_by UUID REFERENCES user_profiles(id),
    confirmed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 인덱스 생성 (실제 데이터 필드 기반)
-- ============================================
-- 식별자 인덱스
CREATE INDEX idx_aed_devices_management_number ON aed_devices(management_number);
CREATE INDEX idx_aed_devices_equipment_number ON aed_devices(equipment_number);
CREATE INDEX idx_aed_devices_serial ON aed_devices(serial_number);

-- 지역/조직 인덱스
CREATE INDEX idx_aed_devices_province ON aed_devices(province);
CREATE INDEX idx_aed_devices_district ON aed_devices(district);
CREATE INDEX idx_aed_devices_health_center ON aed_devices(health_center_id);

-- 상태/유효기간 인덱스
CREATE INDEX idx_aed_devices_operation_status ON aed_devices(operation_status);
CREATE INDEX idx_aed_devices_battery_expiry ON aed_devices(battery_expiry_date);
CREATE INDEX idx_aed_devices_pad_expiry ON aed_devices(pad_expiry_date);

-- 점검 관련 인덱스
CREATE INDEX idx_inspections_device ON inspections(device_id);
CREATE INDEX idx_inspections_inspector ON inspections(inspector_id);
CREATE INDEX idx_inspections_date ON inspections(inspection_date DESC);

-- ============================================
-- 4. 트리거 적용
-- ============================================
CREATE TRIGGER update_aed_devices_updated_at 
    BEFORE UPDATE ON public.aed_devices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inspections_updated_at 
    BEFORE UPDATE ON public.inspections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. RLS 정책
-- ============================================
ALTER TABLE aed_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

-- AED 장치: 모든 사용자 조회 가능
CREATE POLICY "aed_devices_select_all" ON aed_devices
    FOR SELECT USING (true);

-- AED 장치: 관리자만 수정
CREATE POLICY "aed_devices_modify_admin" ON aed_devices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('master', 'emergency_center_admin', 'regional_admin', 'local_admin')
            AND user_profiles.is_active = true
        )
    );

-- 점검 기록: 본인 기록 접근
CREATE POLICY "inspections_own_records" ON inspections
    FOR ALL USING (
        inspector_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('master', 'emergency_center_admin')
        )
    );

-- 점검 기록: 같은 조직 조회
CREATE POLICY "inspections_same_org" ON inspections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up1
            JOIN user_profiles up2 ON up1.organization_id = up2.organization_id
            WHERE up1.id = auth.uid()
            AND up2.id = inspections.inspector_id
        )
    );

-- ============================================
-- 6. 점검 우선순위 계산 뷰
-- ============================================

-- 점검 우선순위 및 긴급도 계산 뷰
CREATE OR REPLACE VIEW inspection_priorities AS
SELECT 
    ad.*,
    -- 우선순위 점수 계산
    CASE 
        -- 배터리 만료 점수 (0-40점)
        WHEN battery_expiry_date < CURRENT_DATE THEN 40
        WHEN battery_expiry_date < CURRENT_DATE + INTERVAL '7 days' THEN 35
        WHEN battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 25
        WHEN battery_expiry_date < CURRENT_DATE + INTERVAL '60 days' THEN 15
        ELSE 0
    END +
    CASE 
        -- 패드 만료 점수 (0-40점)
        WHEN pad_expiry_date < CURRENT_DATE THEN 40
        WHEN pad_expiry_date < CURRENT_DATE + INTERVAL '7 days' THEN 35
        WHEN pad_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 25
        WHEN pad_expiry_date < CURRENT_DATE + INTERVAL '60 days' THEN 15
        ELSE 0
    END +
    CASE 
        -- 최근 점검일 점수 (0-20점)
        WHEN last_inspection_date IS NULL THEN 20
        WHEN last_inspection_date < CURRENT_DATE - INTERVAL '60 days' THEN 20
        WHEN last_inspection_date < CURRENT_DATE - INTERVAL '45 days' THEN 15
        WHEN last_inspection_date < CURRENT_DATE - INTERVAL '30 days' THEN 10
        ELSE 0
    END AS priority_score,
    
    -- 긴급도 레벨
    CASE
        WHEN battery_expiry_date < CURRENT_DATE OR pad_expiry_date < CURRENT_DATE THEN 'critical'
        WHEN battery_expiry_date < CURRENT_DATE + INTERVAL '7 days' OR 
             pad_expiry_date < CURRENT_DATE + INTERVAL '7 days' THEN 'urgent'
        WHEN battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR 
             pad_expiry_date < CURRENT_DATE + INTERVAL '30 days' OR
             last_inspection_date < CURRENT_DATE - INTERVAL '45 days' THEN 'high'
        WHEN battery_expiry_date < CURRENT_DATE + INTERVAL '60 days' OR 
             pad_expiry_date < CURRENT_DATE + INTERVAL '60 days' OR
             last_inspection_date < CURRENT_DATE - INTERVAL '30 days' THEN 'medium'
        ELSE 'normal'
    END AS priority_level,
    
    -- 점검 필요 일수
    GREATEST(
        0,
        30 - COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - last_inspection_date)), 30)
    )::INTEGER AS days_until_inspection,
    
    -- 유효기간 잔여일
    LEAST(
        COALESCE(EXTRACT(DAY FROM (battery_expiry_date - CURRENT_DATE)), 999),
        COALESCE(EXTRACT(DAY FROM (pad_expiry_date - CURRENT_DATE)), 999)
    )::INTEGER AS days_until_expiry
    
FROM aed_devices ad
WHERE operation_status NOT IN ('disposed', 'removed')
ORDER BY priority_score DESC, days_until_expiry ASC;

-- 관할 보건소별 점검 현황 뷰
CREATE OR REPLACE VIEW health_center_inspection_stats AS
SELECT 
    health_center_name,
    COUNT(*) AS total_devices,
    COUNT(CASE WHEN last_inspection_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) AS inspected_30days,
    COUNT(CASE WHEN battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 1 END) AS battery_expiring_soon,
    COUNT(CASE WHEN pad_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 1 END) AS pad_expiring_soon,
    COUNT(CASE WHEN operation_status = 'active' THEN 1 END) AS active_devices,
    ROUND(
        100.0 * COUNT(CASE WHEN last_inspection_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) / 
        NULLIF(COUNT(*), 0), 
        2
    ) AS inspection_rate
FROM aed_devices
WHERE operation_status NOT IN ('disposed', 'removed')
GROUP BY health_center_name
ORDER BY inspection_rate ASC;

COMMENT ON VIEW inspection_priorities IS '점검 우선순위 계산 뷰 - 유효기간과 최근 점검일 기반';
COMMENT ON VIEW health_center_inspection_stats IS '보건소별 점검 현황 통계';