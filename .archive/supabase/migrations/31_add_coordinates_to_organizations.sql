-- organizations 테이블에 좌표 필드 추가

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 좌표 인덱스 추가 (거리 계산 성능 향상)
CREATE INDEX IF NOT EXISTS idx_organizations_coordinates
ON organizations USING gist (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON COLUMN organizations.latitude IS '보건소/기관 위도 (거리 계산용)';
COMMENT ON COLUMN organizations.longitude IS '보건소/기관 경도 (거리 계산용)';
