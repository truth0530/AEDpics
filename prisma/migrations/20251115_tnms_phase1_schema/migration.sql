-- CreateTable
CREATE TABLE "administrative_regions" (
    "region_code" VARCHAR(20) NOT NULL,
    "region_type" VARCHAR(20),
    "korean_name" VARCHAR(100) NOT NULL,
    "short_name" VARCHAR(50),
    "parent_code" VARCHAR(20),
    "level" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_url" VARCHAR(500),
    "last_verified_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "administrative_regions_pkey" PRIMARY KEY ("region_code")
);

-- CreateTable
CREATE TABLE "institution_registry" (
    "standard_code" VARCHAR(50) NOT NULL,
    "canonical_name" VARCHAR(255) NOT NULL,
    "region_code" VARCHAR(20),
    "category" VARCHAR(50),
    "sub_category" VARCHAR(100),
    "road_address" VARCHAR(255),
    "lot_address" VARCHAR(255),
    "postal_code" VARCHAR(10),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "address_hash" VARCHAR(64),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(255),
    "last_modified_by" VARCHAR(255),
    "last_modified_reason" TEXT,

    CONSTRAINT "institution_registry_pkey" PRIMARY KEY ("standard_code")
);

-- CreateTable
CREATE TABLE "institution_aliases" (
    "id" BIGSERIAL NOT NULL,
    "standard_code" VARCHAR(50) NOT NULL,
    "alias_name" VARCHAR(255) NOT NULL,
    "alias_source" VARCHAR(50),
    "source_road_address" VARCHAR(255),
    "source_lot_address" VARCHAR(255),
    "source_postal_code" VARCHAR(10),
    "match_score" INTEGER NOT NULL DEFAULT 100,
    "normalization_applied" BOOLEAN NOT NULL DEFAULT false,
    "address_match" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" VARCHAR(255),
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "institution_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "normalization_rules" (
    "rule_id" SERIAL NOT NULL,
    "rule_name" VARCHAR(100) NOT NULL,
    "rule_type" VARCHAR(50),
    "rule_spec" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" VARCHAR(255),

    CONSTRAINT "normalization_rules_pkey" PRIMARY KEY ("rule_id")
);

-- CreateTable
CREATE TABLE "institution_validation_log" (
    "log_id" BIGSERIAL NOT NULL,
    "validation_run_id" VARCHAR(100),
    "run_type" VARCHAR(50),
    "source_table" VARCHAR(100),
    "source_name" VARCHAR(255) NOT NULL,
    "matched_standard_code" VARCHAR(50),
    "match_confidence" INTEGER,
    "is_successful" BOOLEAN,
    "error_reason" VARCHAR(500),
    "manual_review_status" VARCHAR(50),
    "manual_review_notes" TEXT,
    "reviewed_by" VARCHAR(255),
    "reviewed_at" TIMESTAMPTZ(6),
    "debug_signals" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institution_validation_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "institution_audit_log" (
    "audit_id" BIGSERIAL NOT NULL,
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" VARCHAR(64) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "changed_fields" JSONB,
    "actor_id" VARCHAR(255),
    "actor_role" VARCHAR(50),
    "reason" TEXT,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institution_audit_log_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "institution_metrics" (
    "metric_id" BIGSERIAL NOT NULL,
    "metric_date" DATE NOT NULL,
    "total_institutions" INTEGER,
    "total_aliases" INTEGER,
    "matched_count" INTEGER,
    "unmatched_count" INTEGER,
    "match_success_rate" DECIMAL(5,2),
    "auto_recommend_success_rate" DECIMAL(5,2),
    "search_hit_rate" DECIMAL(5,2),
    "address_match_rate" DECIMAL(5,2),
    "validation_run_count" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institution_metrics_pkey" PRIMARY KEY ("metric_id")
);

-- CreateIndex
CREATE INDEX "idx_administrative_regions_name" ON "administrative_regions"("korean_name");

-- CreateIndex
CREATE INDEX "idx_administrative_regions_parent" ON "administrative_regions"("parent_code");

-- CreateIndex
CREATE INDEX "idx_institution_registry_name" ON "institution_registry"("canonical_name");

-- CreateIndex
CREATE INDEX "idx_institution_registry_region" ON "institution_registry"("region_code");

-- CreateIndex
CREATE INDEX "idx_institution_registry_address_hash" ON "institution_registry"("address_hash");

-- CreateIndex
CREATE INDEX "idx_institution_registry_active" ON "institution_registry"("is_active");

-- CreateIndex
CREATE INDEX "idx_institution_aliases_name" ON "institution_aliases"("alias_name");

-- CreateIndex
CREATE INDEX "idx_institution_aliases_source" ON "institution_aliases"("alias_source");

-- CreateIndex
CREATE INDEX "idx_institution_aliases_standard_code" ON "institution_aliases"("standard_code");

-- CreateIndex
CREATE INDEX "idx_institution_aliases_address" ON "institution_aliases"("source_road_address");

-- CreateIndex
CREATE UNIQUE INDEX "normalization_rules_rule_name_key" ON "normalization_rules"("rule_name");

-- CreateIndex
CREATE INDEX "idx_normalization_rules_priority" ON "normalization_rules"("priority");

-- CreateIndex
CREATE INDEX "idx_normalization_rules_active" ON "normalization_rules"("is_active");

-- CreateIndex
CREATE INDEX "idx_institution_validation_run" ON "institution_validation_log"("validation_run_id");

-- CreateIndex
CREATE INDEX "idx_institution_validation_success" ON "institution_validation_log"("is_successful");

-- CreateIndex
CREATE INDEX "idx_institution_validation_status" ON "institution_validation_log"("manual_review_status");

-- CreateIndex
CREATE INDEX "idx_institution_audit_record" ON "institution_audit_log"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "idx_institution_audit_actor" ON "institution_audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "idx_institution_audit_action" ON "institution_audit_log"("action");

-- CreateIndex
CREATE INDEX "idx_institution_metrics_date" ON "institution_metrics"("metric_date");

-- AddForeignKey
ALTER TABLE "administrative_regions" ADD CONSTRAINT "administrative_regions_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "administrative_regions"("region_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_registry" ADD CONSTRAINT "institution_registry_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "administrative_regions"("region_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_aliases" ADD CONSTRAINT "institution_aliases_standard_code_fkey" FOREIGN KEY ("standard_code") REFERENCES "institution_registry"("standard_code") ON DELETE CASCADE ON UPDATE CASCADE;

