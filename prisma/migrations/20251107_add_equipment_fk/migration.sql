-- Phase 1: Add Equipment Foreign Keys
-- Connects inspection tables to aed_data via equipment_serial

-- 1. inspection_schedule_entries FK constraint
ALTER TABLE "aedpics"."inspection_schedule_entries"
ADD CONSTRAINT "fk_ise_equipment_serial"
FOREIGN KEY ("device_equipment_serial")
REFERENCES "aedpics"."aed_data"("equipment_serial")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 2. inspection_assignments FK constraint  
ALTER TABLE "aedpics"."inspection_assignments"
ADD CONSTRAINT "fk_ia_equipment_serial"
FOREIGN KEY ("equipment_serial")
REFERENCES "aedpics"."aed_data"("equipment_serial")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 3. Create index for FK lookups (performance optimization)
CREATE INDEX "idx_ise_device_equipment_serial" 
ON "aedpics"."inspection_schedule_entries"("device_equipment_serial");

CREATE INDEX "idx_ia_equipment_serial" 
ON "aedpics"."inspection_assignments"("equipment_serial");

-- 4. Verify FK constraints created
-- Run validation: SELECT * FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='aedpics';
