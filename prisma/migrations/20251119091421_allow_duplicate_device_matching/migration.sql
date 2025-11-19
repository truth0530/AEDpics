-- DropIndex: 기존 unique constraint 제거
-- 기존: (target_list_year, equipment_serial) 조합이 유니크
-- 이유: 하나의 AED가 여러 의무설치기관에 매칭될 수 있도록 허용
DROP INDEX IF EXISTS "aedpics"."target_list_devices_target_list_year_equipment_serial_key";

-- CreateIndex: 새로운 unique constraint 추가
-- 새로운: (target_list_year, equipment_serial, target_institution_id) 조합이 유니크
-- 효과: 같은 AED를 같은 기관에 중복 매칭하는 것만 방지하고, 서로 다른 기관에는 중복 매칭 허용
CREATE UNIQUE INDEX IF NOT EXISTS "unique_year_serial_institution"
ON "aedpics"."target_list_devices"("target_list_year", "equipment_serial", "target_institution_id");
