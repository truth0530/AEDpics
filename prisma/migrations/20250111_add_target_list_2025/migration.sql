-- CreateTable
CREATE TABLE IF NOT EXISTS "aedpics"."target_list_2025" (
    "target_key" VARCHAR(255) NOT NULL,
    "no" INTEGER,
    "sido" VARCHAR(50),
    "gugun" VARCHAR(100),
    "division" VARCHAR(100),
    "sub_division" VARCHAR(100),
    "institution_name" VARCHAR(255),
    "unique_key" VARCHAR(100),
    "address" VARCHAR(500),
    "contact" VARCHAR(100),
    "target_keygroup" VARCHAR(255),
    "data_year" INTEGER DEFAULT 2025,
    "imported_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "target_list_2025_pkey" PRIMARY KEY ("target_key")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_target_2025_keygroup" ON "aedpics"."target_list_2025"("target_keygroup");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_target_2025_location" ON "aedpics"."target_list_2025"("sido", "gugun");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_target_2025_unique_key" ON "aedpics"."target_list_2025"("unique_key");
