-- Update NULL approval_status values to 'submitted'
UPDATE "inspections"
SET "approval_status" = 'submitted'::"inspection_approval_status"
WHERE "approval_status" IS NULL;

-- AlterColumn: Make approval_status NOT NULL
ALTER TABLE "inspections"
ALTER COLUMN "approval_status" SET NOT NULL;
