-- AED 데이터 공개 읽기 정책 (수정된 버전)
-- aed_data 테이블의 실제 스키마에 맞춰 수정

-- 기존 정책 삭제
DROP POLICY IF EXISTS "AED 데이터 공개 읽기" ON aed_data;
DROP POLICY IF EXISTS "AED 데이터 수정은 인증된 사용자만" ON aed_data;
DROP POLICY IF EXISTS "AED 데이터 삽입은 관리자만" ON aed_data;
DROP POLICY IF EXISTS "AED 데이터 삭제는 관리자만" ON aed_data;

-- RLS 활성화
ALTER TABLE aed_data ENABLE ROW LEVEL SECURITY;

-- 1. 공개 읽기 정책 - 누구나 읽기 가능
CREATE POLICY "AED 데이터 공개 읽기"
ON aed_data
FOR SELECT
TO public  -- anon과 authenticated 모두 포함
USING (true);

-- 2. 수정 권한 - 인증된 관리자만
CREATE POLICY "AED 데이터 수정은 관리자만"
ON aed_data
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      auth.users.email LIKE '%@nmc.or.kr'
      OR auth.users.email LIKE '%@korea.kr'
    )
  )
);

-- 3. 삽입 권한 - 인증된 관리자만
CREATE POLICY "AED 데이터 삽입은 관리자만"
ON aed_data
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email LIKE '%@nmc.or.kr'
  )
);

-- 4. 삭제 권한 - 인증된 관리자만
CREATE POLICY "AED 데이터 삭제는 관리자만"
ON aed_data
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.email LIKE '%@nmc.or.kr'
  )
);

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_aed_data_geo
ON aed_data(latitude, longitude)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND latitude != 0
  AND longitude != 0;

CREATE INDEX IF NOT EXISTS idx_aed_data_region
ON aed_data(sido, gugun);

CREATE INDEX IF NOT EXISTS idx_aed_data_serial
ON aed_data(equipment_serial);

-- 정책 적용 확인
DO $$
BEGIN
  RAISE NOTICE 'RLS 정책이 적용되었습니다.';
  RAISE NOTICE '- 공개 읽기: 모든 사용자';
  RAISE NOTICE '- 수정/삽입/삭제: 인증된 관리자만';
END $$;

-- 테스트 쿼리 (확인용)
-- SELECT count(*) FROM aed_data; -- anon 사용자도 실행 가능해야 함