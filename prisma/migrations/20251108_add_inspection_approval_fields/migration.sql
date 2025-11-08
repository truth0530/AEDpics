-- CreateEnum
CREATE TYPE "inspection_approval_status" AS ENUM ('submitted', 'pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "inspections" ADD COLUMN "approval_status" "inspection_approval_status" NOT NULL DEFAULT 'submitted',
ADD COLUMN "approved_by_id" UUID,
ADD COLUMN "approved_at" TIMESTAMPTZ(6),
ADD COLUMN "rejection_reason" TEXT;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "user_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateIndex
CREATE INDEX "idx_inspections_approval_status" ON "inspections"("approval_status");

-- CreateIndex
CREATE INDEX "idx_inspections_approved_by_id" ON "inspections"("approved_by_id");
