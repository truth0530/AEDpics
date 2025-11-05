-- 보건소 명칭 매핑 테이블
-- 보건소의 고유 ID와 다양한 명칭 변형을 관리
-- 2025-09-15 작성

-- 1. 보건소 마스터 테이블
CREATE TABLE IF NOT EXISTS public.health_centers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL, -- 고유 코드 (예: HC_SEOUL_GANGNAM)
    canonical_name TEXT NOT NULL, -- 표준 명칭 (예: 서울특별시 강남구 보건소)
    sido VARCHAR(50) NOT NULL, -- 시도
    gugun VARCHAR(50), -- 구군
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 보건소 명칭 별칭 테이블 (다양한 표기법 관리)
CREATE TABLE IF NOT EXISTS public.health_center_aliases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    health_center_id UUID REFERENCES public.health_centers(id) ON DELETE CASCADE,
    alias_name TEXT NOT NULL, -- 별칭 (예: 강남구보건소, 강남보건소 등)
    alias_type VARCHAR(50), -- 별칭 유형 (original, variation, legacy 등)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(health_center_id, alias_name)
);

-- 3. 보건소 명칭 변경 이력 테이블
CREATE TABLE IF NOT EXISTS public.health_center_name_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    health_center_id UUID REFERENCES public.health_centers(id) ON DELETE CASCADE,
    old_name TEXT NOT NULL,
    new_name TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by UUID REFERENCES auth.users(id),
    reason TEXT
);

-- 4. profiles 테이블에 health_center_id 추가
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS health_center_id UUID REFERENCES public.health_centers(id),
    ADD COLUMN IF NOT EXISTS organization_text TEXT; -- fallback용 텍스트 저장

-- 5. aed_data 테이블에 health_center_id 추가 (optional)
-- 이렇게 하면 텍스트 매칭 없이 직접 조인 가능
ALTER TABLE public.aed_data
    ADD COLUMN IF NOT EXISTS health_center_id UUID REFERENCES public.health_centers(id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_health_centers_code ON public.health_centers(code);
CREATE INDEX IF NOT EXISTS idx_health_centers_canonical_name ON public.health_centers(canonical_name);
CREATE INDEX IF NOT EXISTS idx_health_center_aliases_name ON public.health_center_aliases(alias_name);
CREATE INDEX IF NOT EXISTS idx_health_center_aliases_health_center ON public.health_center_aliases(health_center_id);
CREATE INDEX IF NOT EXISTS idx_profiles_health_center ON public.profiles(health_center_id);
CREATE INDEX IF NOT EXISTS idx_aed_data_health_center ON public.aed_data(health_center_id);

-- 보건소 명칭으로 ID를 찾는 함수
CREATE OR REPLACE FUNCTION find_health_center_id(input_name TEXT)
RETURNS UUID AS $$
DECLARE
    center_id UUID;
    normalized_input TEXT;
BEGIN
    -- 입력값 정규화 (공백, 특수문자 제거)
    normalized_input := LOWER(REGEXP_REPLACE(input_name, '[\s\-\.]+', '', 'g'));
    
    -- 1. 정확한 표준명 매칭
    SELECT id INTO center_id 
    FROM public.health_centers 
    WHERE LOWER(REGEXP_REPLACE(canonical_name, '[\s\-\.]+', '', 'g')) = normalized_input
    LIMIT 1;
    
    IF center_id IS NOT NULL THEN
        RETURN center_id;
    END IF;
    
    -- 2. 별칭 테이블에서 검색
    SELECT hc.id INTO center_id
    FROM public.health_centers hc
    JOIN public.health_center_aliases hca ON hc.id = hca.health_center_id
    WHERE LOWER(REGEXP_REPLACE(hca.alias_name, '[\s\-\.]+', '', 'g')) = normalized_input
    LIMIT 1;
    
    IF center_id IS NOT NULL THEN
        RETURN center_id;
    END IF;
    
    -- 3. 부분 매칭 (fuzzy matching)
    SELECT id INTO center_id
    FROM public.health_centers
    WHERE canonical_name ILIKE '%' || input_name || '%'
       OR input_name ILIKE '%' || canonical_name || '%'
    LIMIT 1;
    
    RETURN center_id;
END;
$$ LANGUAGE plpgsql;

-- 보건소별 AED 데이터를 조회하는 뷰
CREATE OR REPLACE VIEW aed_by_health_center AS
SELECT 
    hc.id as health_center_id,
    hc.canonical_name as health_center_name,
    hc.code as health_center_code,
    ad.*
FROM public.aed_data ad
LEFT JOIN public.health_centers hc ON 
    hc.id = ad.health_center_id 
    OR hc.id = find_health_center_id(ad.jurisdiction_health_center);

-- RLS 정책 추가
ALTER TABLE public.health_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_center_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_center_name_history ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 보건소 목록을 조회할 수 있도록
CREATE POLICY "Health centers are viewable by all" 
    ON public.health_centers FOR SELECT 
    USING (true);

CREATE POLICY "Health center aliases are viewable by all" 
    ON public.health_center_aliases FOR SELECT 
    USING (true);

-- 관리자만 보건소 정보를 수정할 수 있도록
CREATE POLICY "Only admins can manage health centers" 
    ON public.health_centers FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('master', 'admin')
        )
    );

CREATE POLICY "Only admins can manage aliases" 
    ON public.health_center_aliases FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('master', 'admin')
        )
    );

CREATE POLICY "History is viewable by authenticated users" 
    ON public.health_center_name_history FOR SELECT 
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can insert history" 
    ON public.health_center_name_history FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('master', 'admin')
        )
    );

COMMENT ON TABLE public.health_centers IS '보건소 마스터 데이터 - 고유 ID로 관리';
COMMENT ON TABLE public.health_center_aliases IS '보건소 명칭 별칭 관리 - 다양한 표기법 수용';
COMMENT ON TABLE public.health_center_name_history IS '보건소 명칭 변경 이력';
COMMENT ON COLUMN public.profiles.health_center_id IS '사용자가 속한 보건소 ID';
COMMENT ON COLUMN public.profiles.organization_text IS '보건소 매칭 실패 시 원본 텍스트 저장';