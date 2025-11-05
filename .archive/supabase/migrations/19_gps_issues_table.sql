-- GPS 이상 데이터 저장 테이블
CREATE TABLE IF NOT EXISTS gps_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aed_data_id INTEGER REFERENCES aed_data(id) ON DELETE CASCADE,
  management_number VARCHAR(255) NOT NULL,
  issue_type VARCHAR(50) NOT NULL, -- 'default_coord', 'address_mismatch', 'outlier', 'duplicate', 'cluster'
  severity VARCHAR(20) NOT NULL, -- 'critical', 'high', 'medium', 'low'
  description TEXT,
  detected_lat DECIMAL(10, 8),
  detected_lng DECIMAL(11, 8),
  expected_lat DECIMAL(10, 8),
  expected_lng DECIMAL(11, 8),
  distance_km DECIMAL(10, 2),
  metadata JSONB, -- 추가 정보 저장
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_gps_issues_aed_id ON gps_issues(aed_data_id);
CREATE INDEX idx_gps_issues_management_number ON gps_issues(management_number);
CREATE INDEX idx_gps_issues_issue_type ON gps_issues(issue_type);
CREATE INDEX idx_gps_issues_severity ON gps_issues(severity);
CREATE INDEX idx_gps_issues_is_resolved ON gps_issues(is_resolved);
CREATE INDEX idx_gps_issues_created_at ON gps_issues(created_at DESC);

-- GPS 분석 실행 로그 테이블
CREATE TABLE IF NOT EXISTS gps_analysis_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_date DATE NOT NULL,
  total_records INTEGER,
  issues_found INTEGER,
  default_coordinates INTEGER,
  address_mismatch INTEGER,
  outliers INTEGER,
  duplicate_coordinates INTEGER,
  clusters INTEGER,
  execution_time_ms INTEGER,
  status VARCHAR(20), -- 'success', 'failed', 'partial'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 중복 실행 방지를 위한 유니크 인덱스
CREATE UNIQUE INDEX idx_gps_analysis_date ON gps_analysis_logs(analysis_date);

-- GPS 이상이 있는 AED 조회 뷰
CREATE OR REPLACE VIEW aed_with_gps_issues AS
SELECT
  a.*,
  gi.issue_type as gps_issue_type,
  gi.severity as gps_issue_severity,
  gi.description as gps_issue_description,
  gi.is_resolved as gps_issue_resolved,
  CASE
    WHEN gi.severity = 'critical' THEN 100
    WHEN gi.severity = 'high' THEN 75
    WHEN gi.severity = 'medium' THEN 50
    WHEN gi.severity = 'low' THEN 25
    ELSE 0
  END as gps_issue_score
FROM aed_data a
LEFT JOIN gps_issues gi ON a.id = gi.aed_data_id AND gi.is_resolved = FALSE
WHERE gi.id IS NOT NULL;

-- 우선순위 계산에 GPS 이슈 반영
CREATE OR REPLACE VIEW aed_priority_with_gps AS
SELECT
  a.*,
  -- 기존 우선순위 점수
  CASE
    WHEN battery_expiry_date < CURRENT_DATE THEN 100
    WHEN battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 80
    WHEN patch_expiry_date < CURRENT_DATE THEN 90
    WHEN patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 70
    WHEN last_inspection_date < CURRENT_DATE - INTERVAL '6 months' THEN 60
    WHEN last_inspection_date < CURRENT_DATE - INTERVAL '3 months' THEN 40
    ELSE 10
  END as base_priority_score,
  -- GPS 이슈 점수
  COALESCE(
    (SELECT MAX(CASE
      WHEN severity = 'critical' THEN 100
      WHEN severity = 'high' THEN 75
      WHEN severity = 'medium' THEN 50
      WHEN severity = 'low' THEN 25
      ELSE 0
    END)
    FROM gps_issues gi
    WHERE gi.aed_data_id = a.id AND gi.is_resolved = FALSE),
    0
  ) as gps_issue_score,
  -- 종합 우선순위 점수
  GREATEST(
    CASE
      WHEN battery_expiry_date < CURRENT_DATE THEN 100
      WHEN battery_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 80
      WHEN patch_expiry_date < CURRENT_DATE THEN 90
      WHEN patch_expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 70
      WHEN last_inspection_date < CURRENT_DATE - INTERVAL '6 months' THEN 60
      WHEN last_inspection_date < CURRENT_DATE - INTERVAL '3 months' THEN 40
      ELSE 10
    END,
    COALESCE(
      (SELECT MAX(CASE
        WHEN severity = 'critical' THEN 100
        WHEN severity = 'high' THEN 75
        WHEN severity = 'medium' THEN 50
        WHEN severity = 'low' THEN 25
        ELSE 0
      END)
      FROM gps_issues gi
      WHERE gi.aed_data_id = a.id AND gi.is_resolved = FALSE),
      0
    )
  ) as total_priority_score,
  -- GPS 이슈 존재 여부
  EXISTS(
    SELECT 1 FROM gps_issues gi
    WHERE gi.aed_data_id = a.id AND gi.is_resolved = FALSE
  ) as has_gps_issue
FROM aed_data a;

-- RLS 정책
ALTER TABLE gps_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_analysis_logs ENABLE ROW LEVEL SECURITY;

-- 읽기 권한은 모든 인증된 사용자
CREATE POLICY "GPS 이슈 읽기" ON gps_issues
  FOR SELECT USING (auth.role() = 'authenticated');

-- 쓰기 권한은 관리자만
CREATE POLICY "GPS 이슈 쓰기" ON gps_issues
  FOR INSERT USING (auth.jwt() ->> 'email' IN (
    SELECT email FROM users WHERE role IN ('admin', 'master')
  ));

CREATE POLICY "GPS 이슈 수정" ON gps_issues
  FOR UPDATE USING (auth.jwt() ->> 'email' IN (
    SELECT email FROM users WHERE role IN ('admin', 'master', 'inspector')
  ));

-- 분석 로그는 시스템만 쓰기 가능
CREATE POLICY "GPS 분석 로그 읽기" ON gps_analysis_logs
  FOR SELECT USING (auth.role() = 'authenticated');