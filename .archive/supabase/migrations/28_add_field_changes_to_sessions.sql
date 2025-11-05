-- ============================================
-- Migration 28: inspection_sessions에 field_changes 컬럼 추가
-- 실행일: 2025-10-03
-- 목적: 점검 중 변경된 필드 추적
-- ============================================

-- inspection_sessions 테이블에 field_changes 컬럼 추가
ALTER TABLE public.inspection_sessions
ADD COLUMN IF NOT EXISTS field_changes JSONB DEFAULT '{}';

-- 컬럼 코멘트 추가
COMMENT ON COLUMN inspection_sessions.field_changes IS '점검 중 변경된 필드 정보 (원본값, 수정값, 사유 포함)';

-- ============================================
-- 마이그레이션 완료
-- ============================================
