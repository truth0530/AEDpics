-- ============================================
-- Schema Migrations 추적 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.schema_migrations IS 'Migration 실행 이력 추적 테이블';
