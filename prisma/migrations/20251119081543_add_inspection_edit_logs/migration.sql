-- CreateTable
CREATE TABLE IF NOT EXISTS "aedpics"."inspection_edit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inspection_id" UUID NOT NULL,
    "editor_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "edited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_edit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_inspection_edit_logs_inspection" ON "aedpics"."inspection_edit_logs"("inspection_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_inspection_edit_logs_editor" ON "aedpics"."inspection_edit_logs"("editor_id");

-- AddForeignKey
ALTER TABLE "aedpics"."inspection_edit_logs" ADD CONSTRAINT "inspection_edit_logs_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "aedpics"."inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aedpics"."inspection_edit_logs" ADD CONSTRAINT "inspection_edit_logs_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "aedpics"."user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
