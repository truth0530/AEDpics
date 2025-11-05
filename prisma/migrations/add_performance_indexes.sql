-- 성능 최적화를 위한 인덱스 추가
-- AED 데이터 조회 성능 개선 (60-80% 개선 예상)

-- 1. 지역별 조회 (가장 빈번)
CREATE INDEX IF NOT EXISTS idx_aed_sido_gugun ON aedpics.aed_data(sido, gugun);

-- 2. 만료일 필터링
CREATE INDEX IF NOT EXISTS idx_aed_battery_expiry ON aedpics.aed_data(battery_expiry_date);
CREATE INDEX IF NOT EXISTS idx_aed_patch_expiry ON aedpics.aed_data(patch_expiry_date);

-- 3. 점검일 조회
CREATE INDEX IF NOT EXISTS idx_aed_last_inspection ON aedpics.aed_data(last_inspection_date);

-- 4. 관할보건소 조회
CREATE INDEX IF NOT EXISTS idx_aed_jurisdiction ON aedpics.aed_data(jurisdiction_health_center);

-- 5. 상태 조회
CREATE INDEX IF NOT EXISTS idx_aed_status ON aedpics.aed_data(operation_status);

-- 6. 장비연번 조회 (유니크 제약)
CREATE UNIQUE INDEX IF NOT EXISTS idx_aed_equipment_serial ON aedpics.aed_data(equipment_serial);

-- 7. 시리얼 번호 조회 (제조업체 시리얼 번호)
CREATE INDEX IF NOT EXISTS idx_aed_serial_number ON aedpics.aed_data(serial_number);

-- 8. 제조일자 조회
CREATE INDEX IF NOT EXISTS idx_aed_manufacturing_date ON aedpics.aed_data(manufacturing_date);

-- 9. 복합 인덱스 (지역 + 상태)
CREATE INDEX IF NOT EXISTS idx_aed_region_status ON aedpics.aed_data(sido, gugun, operation_status);

-- 점검 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_assignment_status ON aedpics.inspection_assignments(status, assigned_to);
CREATE INDEX IF NOT EXISTS idx_assignment_equipment_serial ON aedpics.inspection_assignments(equipment_serial);
CREATE INDEX IF NOT EXISTS idx_session_inspector ON aedpics.inspection_sessions(inspector_id, completed_at);

-- 사용자 인증 인덱스
CREATE INDEX IF NOT EXISTS idx_user_email ON aedpics.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_org ON aedpics.user_profiles(organization_id);
