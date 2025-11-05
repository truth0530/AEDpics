-- AlterEnum
ALTER TYPE "aedpics"."review_status" ADD VALUE IF NOT EXISTS 'cancelled';

-- CreateTable
CREATE TABLE IF NOT EXISTS "aedpics"."organization_change_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "current_organization_id" UUID,
    "requested_organization_id" UUID NOT NULL,
    "reason" TEXT,
    "status" "review_status" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_org_change_requests_user" ON "organization_change_requests"("user_id");
CREATE INDEX IF NOT EXISTS "idx_org_change_requests_status" ON "organization_change_requests"("status");
CREATE INDEX IF NOT EXISTS "idx_org_change_requests_requested_at" ON "organization_change_requests"("requested_at");

-- AddForeignKey
ALTER TABLE "organization_change_requests" ADD CONSTRAINT "organization_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_change_requests" ADD CONSTRAINT "organization_change_requests_current_organization_id_fkey" FOREIGN KEY ("current_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organization_change_requests" ADD CONSTRAINT "organization_change_requests_requested_organization_id_fkey" FOREIGN KEY ("requested_organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_change_requests" ADD CONSTRAINT "organization_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
