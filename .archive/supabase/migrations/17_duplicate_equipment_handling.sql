-- ============================================
-- Migration: 중복 장비연번 처리 시스템
-- 실행일: 2025-09-20
-- 목적: 약 100여대의 중복 장비연번 관리 체계 구축
-- 원칙: 강제 삭제 없이 사용자 확인 후 처리
-- ============================================

-- ============================================
-- 1. 기존 테이블에 중복 관리 필드 추가
-- ============================================

-- 시스템 고유 ID 및 중복 플래그 추가
ALTER TABLE public.aed_devices
  ADD COLUMN IF NOT EXISTS system_unique_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS duplicate_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_group_id TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN (
      'pending',              -- 검증 대기
      'verified_primary',     -- 주 장비로 확인됨
      'verified_duplicate',   -- 중복으로 확인됨
      'verified_legitimate',  -- 정당한 중복 (유지 필요)
      'resolved'             -- 해결 완료
    )),
  ADD COLUMN IF NOT EXISTS duplicate_notes TEXT;

-- 시스템 고유 ID에 UNIQUE 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_aed_system_unique_id
  ON public.aed_devices(system_unique_id);

-- 중복 관리용 인덱스
CREATE INDEX IF NOT EXISTS idx_aed_duplicate_flag
  ON public.aed_devices(duplicate_flag)
  WHERE duplicate_flag = true;

CREATE INDEX IF NOT EXISTS idx_aed_duplicate_group
  ON public.aed_devices(duplicate_group_id)
  WHERE duplicate_group_id IS NOT NULL;

-- ============================================
-- 2. 중복 검사 뷰
-- ============================================

-- 중복 장비연번 분석 뷰
CREATE OR REPLACE VIEW public.duplicate_equipment_analysis AS
WITH duplicate_counts AS (
  SELECT
    equipment_number,
    COUNT(*) as duplicate_count,
    STRING_AGG(DISTINCT COALESCE(management_number, 'N/A'), ', ' ORDER BY management_number) as management_numbers,
    STRING_AGG(DISTINCT COALESCE(installation_institution, 'N/A'), ' | ' ORDER BY installation_institution) as institutions,
    STRING_AGG(DISTINCT COALESCE(province || ' ' || district, 'N/A'), ' | ' ORDER BY province || ' ' || district) as locations,
    ARRAY_AGG(id ORDER BY created_at) as device_ids,
    ARRAY_AGG(system_unique_id ORDER BY created_at) as system_ids,
    MIN(created_at) as first_created,
    MAX(updated_at) as last_updated,
    MAX(last_inspection_date) as latest_inspection
  FROM public.aed_devices
  WHERE equipment_number IS NOT NULL
    AND equipment_number != ''
    AND equipment_number != 'N/A'
  GROUP BY equipment_number
  HAVING COUNT(*) > 1
)
SELECT
  equipment_number,
  duplicate_count,
  management_numbers,
  institutions,
  locations,
  device_ids,
  system_ids,
  first_created,
  last_updated,
  latest_inspection,
  CASE
    WHEN duplicate_count = 2 THEN '경미'
    WHEN duplicate_count <= 5 THEN '주의'
    ELSE '심각'
  END as severity_level,
  CASE
    WHEN duplicate_count = 2 THEN '#FEF3C7'  -- yellow-100
    WHEN duplicate_count <= 5 THEN '#FED7AA' -- orange-200
    ELSE '#FEE2E2'                          -- red-100
  END as severity_color
FROM duplicate_counts
ORDER BY duplicate_count DESC, equipment_number;

-- 중복 통계 뷰
CREATE OR REPLACE VIEW public.duplicate_statistics AS
SELECT
  COUNT(DISTINCT equipment_number) as unique_equipment_with_duplicates,
  SUM(duplicate_count) as total_duplicate_records,
  SUM(duplicate_count) - COUNT(DISTINCT equipment_number) as excess_records,
  ROUND(
    (SUM(duplicate_count)::numeric /
    (SELECT COUNT(*) FROM aed_devices WHERE equipment_number IS NOT NULL))::numeric * 100,
    3
  ) as duplicate_percentage,
  MAX(duplicate_count) as max_duplicates_per_equipment,
  ROUND(AVG(duplicate_count)::numeric, 2) as avg_duplicates_per_equipment,
  COUNT(CASE WHEN duplicate_count = 2 THEN 1 END) as pairs_count,
  COUNT(CASE WHEN duplicate_count > 2 AND duplicate_count <= 5 THEN 1 END) as multiple_count,
  COUNT(CASE WHEN duplicate_count > 5 THEN 1 END) as severe_count
FROM duplicate_equipment_analysis;

-- ============================================
-- 3. 중복 해결 로그 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS public.duplicate_resolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_number TEXT NOT NULL,
  duplicate_group_id TEXT NOT NULL,
  affected_device_ids UUID[],
  affected_system_ids UUID[],

  -- 해결 정보
  reason TEXT CHECK (reason IN (
    'input_error',        -- 입력 실수
    'system_migration',   -- 시스템 이관 중 중복
    'manufacturer_issue', -- 제조사 번호 중복
    'legitimate',         -- 정당한 중복 (교체 등)
    'unknown'            -- 원인 불명
  )),

  action_taken TEXT CHECK (action_taken IN (
    'merge',              -- 데이터 병합
    'keep_all',          -- 모두 유지
    'mark_primary',      -- 주 장비 지정
    'delete_duplicates'  -- 중복 삭제
  )),

  primary_device_id UUID,
  primary_system_id UUID,
  resolver_user_id UUID REFERENCES user_profiles(id),
  resolved_at TIMESTAMPTZ DEFAULT NOW(),

  -- 상세 정보
  notes TEXT,
  before_snapshot JSONB,
  after_snapshot JSONB,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resolution_log_equipment
  ON public.duplicate_resolution_log(equipment_number);

CREATE INDEX idx_resolution_log_resolver
  ON public.duplicate_resolution_log(resolver_user_id);

CREATE INDEX idx_resolution_log_date
  ON public.duplicate_resolution_log(resolved_at);

-- ============================================
-- 4. 중복 플래그 업데이트 함수
-- ============================================

CREATE OR REPLACE FUNCTION public.update_duplicate_flags()
RETURNS void AS $$
BEGIN
  -- 모든 중복 플래그 초기화
  UPDATE public.aed_devices
  SET
    duplicate_flag = false,
    duplicate_group_id = NULL,
    duplicate_count = 1
  WHERE duplicate_flag = true;

  -- 중복 항목 플래그 설정
  WITH duplicate_info AS (
    SELECT
      equipment_number,
      COUNT(*) as cnt
    FROM public.aed_devices
    WHERE equipment_number IS NOT NULL
      AND equipment_number != ''
      AND equipment_number != 'N/A'
    GROUP BY equipment_number
    HAVING COUNT(*) > 1
  )
  UPDATE public.aed_devices a
  SET
    duplicate_flag = true,
    duplicate_group_id = a.equipment_number,
    duplicate_count = d.cnt
  FROM duplicate_info d
  WHERE a.equipment_number = d.equipment_number;
END;
$$ LANGUAGE plpgsql;

-- 초기 실행
SELECT public.update_duplicate_flags();

-- ============================================
-- 5. 중복 해결 함수
-- ============================================

CREATE OR REPLACE FUNCTION public.resolve_duplicate_equipment(
  p_equipment_number TEXT,
  p_primary_system_id UUID,
  p_action TEXT,
  p_reason TEXT,
  p_resolver_id UUID,
  p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
  v_affected_ids UUID[];
  v_affected_system_ids UUID[];
  v_primary_device_id UUID;
  v_before_snapshot JSONB;
  v_result JSONB;
BEGIN
  -- 영향받는 장비 정보 수집
  SELECT
    ARRAY_AGG(id),
    ARRAY_AGG(system_unique_id)
  INTO v_affected_ids, v_affected_system_ids
  FROM public.aed_devices
  WHERE equipment_number = p_equipment_number;

  -- Primary device ID 찾기
  SELECT id INTO v_primary_device_id
  FROM public.aed_devices
  WHERE system_unique_id = p_primary_system_id;

  -- Before snapshot 저장
  SELECT jsonb_agg(row_to_json(d.*))
  INTO v_before_snapshot
  FROM public.aed_devices d
  WHERE equipment_number = p_equipment_number;

  -- 액션 수행
  CASE p_action
    WHEN 'mark_primary' THEN
      -- 주 장비 지정
      UPDATE public.aed_devices
      SET
        verification_status = 'verified_primary',
        duplicate_notes = COALESCE(duplicate_notes || E'\n', '') ||
                         format('[%s] 주 장비로 지정됨', NOW()::date)
      WHERE system_unique_id = p_primary_system_id;

      -- 나머지는 중복으로 표시
      UPDATE public.aed_devices
      SET
        verification_status = 'verified_duplicate',
        duplicate_notes = COALESCE(duplicate_notes || E'\n', '') ||
                         format('[%s] 중복으로 확인됨 (주 장비: %s)', NOW()::date, p_equipment_number)
      WHERE equipment_number = p_equipment_number
        AND system_unique_id != p_primary_system_id;

    WHEN 'keep_all' THEN
      -- 모두 정당한 중복으로 유지
      UPDATE public.aed_devices
      SET
        verification_status = 'verified_legitimate',
        duplicate_notes = COALESCE(duplicate_notes || E'\n', '') ||
                         format('[%s] 정당한 중복으로 확인됨: %s', NOW()::date, p_notes)
      WHERE equipment_number = p_equipment_number;

    WHEN 'merge' THEN
      -- 데이터 병합 (주의 필요 - 실제로는 더 복잡한 로직 필요)
      -- 여기서는 플래그만 업데이트
      UPDATE public.aed_devices
      SET
        verification_status = 'resolved',
        duplicate_notes = COALESCE(duplicate_notes || E'\n', '') ||
                         format('[%s] 병합 처리됨', NOW()::date)
      WHERE equipment_number = p_equipment_number;

    ELSE
      RAISE EXCEPTION 'Invalid action: %', p_action;
  END CASE;

  -- 로그 기록
  INSERT INTO public.duplicate_resolution_log (
    equipment_number,
    duplicate_group_id,
    affected_device_ids,
    affected_system_ids,
    reason,
    action_taken,
    primary_device_id,
    primary_system_id,
    resolver_user_id,
    notes,
    before_snapshot
  ) VALUES (
    p_equipment_number,
    p_equipment_number,
    v_affected_ids,
    v_affected_system_ids,
    p_reason,
    p_action,
    v_primary_device_id,
    p_primary_system_id,
    p_resolver_id,
    p_notes,
    v_before_snapshot
  );

  -- 결과 반환
  v_result := jsonb_build_object(
    'success', true,
    'equipment_number', p_equipment_number,
    'action', p_action,
    'affected_count', array_length(v_affected_ids, 1),
    'primary_system_id', p_primary_system_id,
    'message', format('%d개 장비가 처리되었습니다', array_length(v_affected_ids, 1))
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. RLS 정책 (선택적)
-- ============================================

-- 중복 해결 로그는 관리자만 접근
ALTER TABLE public.duplicate_resolution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "duplicate_log_admin_only" ON public.duplicate_resolution_log
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('system_admin', 'regional_admin', 'local_admin')
    )
  );

-- ============================================
-- 7. 통계 함수
-- ============================================

CREATE OR REPLACE FUNCTION public.get_duplicate_summary()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_devices', COUNT(*),
    'devices_with_equipment_number', COUNT(equipment_number),
    'unique_equipment_numbers', COUNT(DISTINCT equipment_number),
    'duplicate_affected_devices', COUNT(CASE WHEN duplicate_flag THEN 1 END),
    'duplicate_groups', (
      SELECT COUNT(DISTINCT equipment_number)
      FROM aed_devices
      WHERE duplicate_flag = true
    ),
    'pending_verification', COUNT(CASE WHEN verification_status = 'pending' AND duplicate_flag THEN 1 END),
    'verified_primary', COUNT(CASE WHEN verification_status = 'verified_primary' THEN 1 END),
    'verified_duplicate', COUNT(CASE WHEN verification_status = 'verified_duplicate' THEN 1 END),
    'verified_legitimate', COUNT(CASE WHEN verification_status = 'verified_legitimate' THEN 1 END),
    'resolved', COUNT(CASE WHEN verification_status = 'resolved' THEN 1 END),
    'last_updated', NOW()
  ) INTO v_result
  FROM public.aed_devices;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. 알림 트리거 (선택적)
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_duplicate_detection()
RETURNS TRIGGER AS $$
BEGIN
  -- 새 장비 추가 시 중복 검사
  IF TG_OP = 'INSERT' AND NEW.equipment_number IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.aed_devices
      WHERE equipment_number = NEW.equipment_number
      AND id != NEW.id
    ) THEN
      -- 중복 플래그 설정
      NEW.duplicate_flag := true;
      NEW.duplicate_group_id := NEW.equipment_number;

      -- 기존 항목들도 업데이트
      UPDATE public.aed_devices
      SET
        duplicate_flag = true,
        duplicate_group_id = NEW.equipment_number,
        duplicate_count = (
          SELECT COUNT(*)
          FROM public.aed_devices
          WHERE equipment_number = NEW.equipment_number
        )
      WHERE equipment_number = NEW.equipment_number
        AND id != NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (선택적 - 성능 영향 고려)
-- CREATE TRIGGER trg_duplicate_detection
--   BEFORE INSERT OR UPDATE OF equipment_number
--   ON public.aed_devices
--   FOR EACH ROW
--   EXECUTE FUNCTION public.notify_duplicate_detection();

-- ============================================
-- 9. 초기 데이터 분석 (실행 결과 확인용)
-- ============================================

-- 현재 중복 현황 출력
SELECT
  'Total Duplicates' as metric,
  COUNT(DISTINCT equipment_number) as value
FROM public.aed_devices
WHERE equipment_number IN (
  SELECT equipment_number
  FROM public.aed_devices
  WHERE equipment_number IS NOT NULL
  GROUP BY equipment_number
  HAVING COUNT(*) > 1
)

UNION ALL

SELECT
  'Affected Devices' as metric,
  COUNT(*) as value
FROM public.aed_devices
WHERE equipment_number IN (
  SELECT equipment_number
  FROM public.aed_devices
  WHERE equipment_number IS NOT NULL
  GROUP BY equipment_number
  HAVING COUNT(*) > 1
)

UNION ALL

SELECT
  'Duplicate Rate (%)' as metric,
  ROUND(
    COUNT(*)::numeric /
    (SELECT COUNT(*) FROM aed_devices WHERE equipment_number IS NOT NULL)::numeric * 100,
    3
  ) as value
FROM public.aed_devices
WHERE equipment_number IN (
  SELECT equipment_number
  FROM public.aed_devices
  WHERE equipment_number IS NOT NULL
  GROUP BY equipment_number
  HAVING COUNT(*) > 1
);

-- ============================================
-- 롤백 스크립트 (필요 시)
-- ============================================
/*
-- 추가한 컬럼 제거
ALTER TABLE public.aed_devices
  DROP COLUMN IF EXISTS system_unique_id,
  DROP COLUMN IF EXISTS duplicate_flag,
  DROP COLUMN IF EXISTS duplicate_group_id,
  DROP COLUMN IF EXISTS duplicate_count,
  DROP COLUMN IF EXISTS verification_status,
  DROP COLUMN IF EXISTS duplicate_notes;

-- 뷰 제거
DROP VIEW IF EXISTS public.duplicate_equipment_analysis;
DROP VIEW IF EXISTS public.duplicate_statistics;

-- 테이블 제거
DROP TABLE IF EXISTS public.duplicate_resolution_log;

-- 함수 제거
DROP FUNCTION IF EXISTS public.update_duplicate_flags();
DROP FUNCTION IF EXISTS public.resolve_duplicate_equipment(TEXT, UUID, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_duplicate_summary();
DROP FUNCTION IF EXISTS public.notify_duplicate_detection();
*/