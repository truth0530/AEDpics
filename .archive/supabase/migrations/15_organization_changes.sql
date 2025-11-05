-- 소속 변경 요청 테이블
CREATE TABLE IF NOT EXISTS organization_change_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_organization TEXT,
    current_region TEXT,
    new_organization TEXT NOT NULL,
    new_region TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로필 변경 이력 테이블
CREATE TABLE IF NOT EXISTS profile_change_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES auth.users(id),
    change_type TEXT CHECK (change_type IN ('user_edit', 'admin_edit', 'system')),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_org_change_requests_user ON organization_change_requests(user_id);
CREATE INDEX idx_org_change_requests_status ON organization_change_requests(status);
CREATE INDEX idx_org_change_requests_created ON organization_change_requests(created_at DESC);

CREATE INDEX idx_profile_history_user ON profile_change_history(user_id);
CREATE INDEX idx_profile_history_created ON profile_change_history(created_at DESC);
CREATE INDEX idx_profile_history_field ON profile_change_history(field_name);

-- RLS 정책
ALTER TABLE organization_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_change_history ENABLE ROW LEVEL SECURITY;

-- 소속 변경 요청 정책
-- 사용자는 자신의 요청만 조회 가능
CREATE POLICY "Users can view own change requests" ON organization_change_requests
    FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 요청만 생성 가능
CREATE POLICY "Users can create own change requests" ON organization_change_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 관리자는 모든 요청 조회 가능
CREATE POLICY "Admins can view all change requests" ON organization_change_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin')
        )
    );

-- 관리자는 모든 요청 수정 가능
CREATE POLICY "Admins can update change requests" ON organization_change_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'emergency_center_admin', 'ministry_admin', 'regional_admin')
        )
    );

-- 프로필 변경 이력 정책
-- 사용자는 자신의 이력만 조회 가능
CREATE POLICY "Users can view own history" ON profile_change_history
    FOR SELECT USING (auth.uid() = user_id);

-- 시스템에서만 이력 추가 가능 (서비스 롤 필요)
CREATE POLICY "System can insert history" ON profile_change_history
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'emergency_center_admin', 'ministry_admin')
        )
    );

-- 관리자는 모든 이력 조회 가능
CREATE POLICY "Admins can view all history" ON profile_change_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('master', 'emergency_center_admin', 'ministry_admin')
        )
    );

-- 트리거 함수: 프로필 변경 시 이력 자동 기록
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_record JSONB;
    new_record JSONB;
    field TEXT;
    old_val TEXT;
    new_val TEXT;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        old_record := to_jsonb(OLD);
        new_record := to_jsonb(NEW);

        -- 변경된 필드만 기록
        FOR field IN SELECT jsonb_object_keys(new_record)
        LOOP
            -- updated_at 같은 시스템 필드는 제외
            IF field NOT IN ('updated_at', 'id', 'created_at') THEN
                old_val := old_record->field::TEXT;
                new_val := new_record->field::TEXT;

                IF old_val IS DISTINCT FROM new_val THEN
                    INSERT INTO profile_change_history (
                        user_id,
                        field_name,
                        old_value,
                        new_value,
                        changed_by,
                        change_type
                    ) VALUES (
                        NEW.id,
                        field,
                        NULLIF(trim(both '"' from old_val), 'null'),
                        NULLIF(trim(both '"' from new_val), 'null'),
                        auth.uid(),
                        CASE
                            WHEN auth.uid() = NEW.id THEN 'user_edit'
                            ELSE 'admin_edit'
                        END
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

-- 트리거 생성
DROP TRIGGER IF EXISTS profile_changes_trigger ON user_profiles;
CREATE TRIGGER profile_changes_trigger
AFTER UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION log_profile_changes();

-- 소속 변경 승인 시 프로필 업데이트 함수
CREATE OR REPLACE FUNCTION approve_organization_change(
    request_id UUID,
    reviewer_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    change_request RECORD;
BEGIN
    -- 요청 조회
    SELECT * INTO change_request
    FROM organization_change_requests
    WHERE id = request_id AND status = 'pending';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 요청 상태 업데이트
    UPDATE organization_change_requests
    SET
        status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_note = reviewer_note,
        updated_at = NOW()
    WHERE id = request_id;

    -- 사용자 프로필 업데이트
    UPDATE user_profiles
    SET
        organization_name = change_request.new_organization,
        region = change_request.new_region,
        updated_at = NOW()
    WHERE id = change_request.user_id;

    RETURN TRUE;
END;
$$;

-- 소속 변경 거부 함수
CREATE OR REPLACE FUNCTION reject_organization_change(
    request_id UUID,
    reviewer_note TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE organization_change_requests
    SET
        status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_note = reviewer_note,
        updated_at = NOW()
    WHERE id = request_id AND status = 'pending';

    RETURN FOUND;
END;
$$;

-- 뷰: 대기 중인 변경 요청과 사용자 정보 조인
CREATE OR REPLACE VIEW pending_organization_changes AS
SELECT
    ocr.*,
    up.email,
    up.full_name,
    up.phone
FROM organization_change_requests ocr
JOIN user_profiles up ON ocr.user_id = up.id
WHERE ocr.status = 'pending'
ORDER BY ocr.created_at ASC;

-- 권한 부여
GRANT SELECT ON pending_organization_changes TO authenticated;
GRANT EXECUTE ON FUNCTION approve_organization_change TO authenticated;
GRANT EXECUTE ON FUNCTION reject_organization_change TO authenticated;