-- CreateTable
CREATE TABLE "inspection_field_comparisons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inspection_id" UUID NOT NULL,
    "equipment_serial" VARCHAR(255) NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "field_category" VARCHAR(50) NOT NULL,
    "inspection_value" TEXT,
    "aed_data_value" TEXT,
    "inspection_time" TIMESTAMPTZ(6) NOT NULL,
    "status_at_inspection" VARCHAR(20) NOT NULL,
    "issue_severity" VARCHAR(20),
    "current_aed_value" TEXT,
    "last_checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "improvement_status" VARCHAR(20),
    "improved_at" TIMESTAMPTZ(6),
    "days_since_inspection" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_field_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_field_comparisons_inspection" ON "inspection_field_comparisons"("inspection_id");

-- CreateIndex
CREATE INDEX "idx_field_comparisons_equipment" ON "inspection_field_comparisons"("equipment_serial");

-- CreateIndex
CREATE INDEX "idx_field_comparisons_status" ON "inspection_field_comparisons"("status_at_inspection");

-- CreateIndex
CREATE INDEX "idx_field_comparisons_improvement" ON "inspection_field_comparisons"("improvement_status");

-- CreateIndex
CREATE INDEX "idx_field_comparisons_category" ON "inspection_field_comparisons"("field_category");

-- CreateIndex
CREATE INDEX "idx_field_comparisons_time" ON "inspection_field_comparisons"("inspection_time");

-- CreateIndex
CREATE INDEX "idx_field_comparisons_query" ON "inspection_field_comparisons"("equipment_serial", "field_category", "improvement_status");

-- AddForeignKey
ALTER TABLE "inspection_field_comparisons" ADD CONSTRAINT "inspection_field_comparisons_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_field_comparisons" ADD CONSTRAINT "inspection_field_comparisons_equipment_serial_fkey" FOREIGN KEY ("equipment_serial") REFERENCES "aed_data"("equipment_serial") ON DELETE CASCADE ON UPDATE CASCADE;
