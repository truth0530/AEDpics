-- Create target_list_match_logs table
CREATE TABLE IF NOT EXISTS "aedpics"."target_list_match_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "action" VARCHAR(20) NOT NULL,
  "target_list_year" INTEGER NOT NULL,
  "target_key" VARCHAR(255) NOT NULL,
  "management_numbers" TEXT[] NOT NULL,
  "user_id" UUID NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "target_list_match_logs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "aedpics"."target_list_match_logs"
ADD CONSTRAINT "target_list_match_logs_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "aedpics"."user_profiles"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_match_logs_target" ON "aedpics"."target_list_match_logs"("target_list_year", "target_key");
CREATE INDEX IF NOT EXISTS "idx_match_logs_user" ON "aedpics"."target_list_match_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_match_logs_created" ON "aedpics"."target_list_match_logs"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_match_logs_action" ON "aedpics"."target_list_match_logs"("action");
