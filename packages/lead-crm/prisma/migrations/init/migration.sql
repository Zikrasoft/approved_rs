-- CreateEnum
CREATE TYPE "lead_status" AS ENUM ('NEW', 'NEGOTIATIONS', 'IN_PROGRESS', 'WON', 'LOST', 'POSTPONED');

-- CreateEnum
CREATE TYPE "operation_type" AS ENUM ('PAYOUT', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "digest_list" AS ENUM ('DUE', 'STALE');

-- CreateEnum
CREATE TYPE "lead_kind" AS ENUM ('LEAD', 'CALL_CLICK');

-- CreateEnum
CREATE TYPE "order_outcome" AS ENUM ('WON', 'LOST');

-- CreateEnum
CREATE TYPE "referrer" AS ENUM ('APPROVED');

-- CreateEnum
CREATE TYPE "prompt_kind" AS ENUM ('POSTPONE', 'EDIT_NAME', 'EDIT_CONTACT', 'NOTE');

-- CreateEnum
CREATE TYPE "capture_step" AS ENUM ('LOOKING_FOR', 'BUDGET', 'PHONE', 'CAR_ISSUE', 'CAR', 'SERVICE');

-- CreateEnum
CREATE TYPE "ledger_author" AS ENUM ('OWNER', 'ADMIN');

-- CreateTable
CREATE TABLE "digests" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_id" INTEGER,
    "hidden" INTEGER,

    CONSTRAINT "digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_leads" (
    "digest_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "list" "digest_list" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "digest_leads_pkey" PRIMARY KEY ("digest_id","lead_id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "services" TEXT[],
    "contact_channel" TEXT,
    "comment" TEXT,
    "country" TEXT,
    "source_url" TEXT,
    "visitor_id" TEXT,
    "locale" TEXT NOT NULL,
    "kind" "lead_kind",
    "status" "lead_status" NOT NULL DEFAULT 'NEW',
    "postponed_from" "lead_status",
    "remind_at" DATE,
    "status_changed_at" TIMESTAMPTZ(3) NOT NULL,
    "last_activity_at" TIMESTAMPTZ(3),
    "visitor_active_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "telegram_chat_id" BIGINT,
    "telegram_message_id" INTEGER,
    "pending_prompt_chat_id" BIGINT,
    "pending_prompt_message_id" INTEGER,
    "pending_prompt_kind" "prompt_kind",
    "capture_prompt_chat_id" BIGINT,
    "capture_prompt_step" "capture_step",
    "telegram_id" BIGINT,
    "topic_id" INTEGER,
    "topic_message_id" INTEGER,
    "topic_closed" BOOLEAN NOT NULL DEFAULT false,
    "topic_active_at" TIMESTAMPTZ(3),
    "questionnaire_done" BOOLEAN NOT NULL DEFAULT false,
    "referred_by" "referrer",
    "manager_handoff_at" TIMESTAMPTZ(3),
    "manager_handoff_handle" TEXT,
    "ad_source" JSONB,
    "meta_fbc" TEXT,
    "meta_fbp" TEXT,
    "meta_lead_sent_at" TIMESTAMPTZ(3),
    "order_id" TEXT,
    "order_settled" "order_outcome",
    "order_conflict" "order_outcome",
    "order_stuck" "order_outcome",

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_operations" (
    "id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "type" "operation_type" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT NOT NULL,
    "created_by" "ledger_author" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_prompts" (
    "id" UUID NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "message_id" INTEGER NOT NULL,
    "type" "operation_type" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarantined_records" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "imported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quarantined_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "digests_day_key" ON "digests"("day");

-- CreateIndex
CREATE INDEX "digest_leads_lead_id_idx" ON "digest_leads"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_legacy_id_key" ON "leads"("legacy_id");

-- CreateIndex
CREATE INDEX "leads_brand_visitor_id_idx" ON "leads"("brand", "visitor_id");

-- CreateIndex
CREATE INDEX "leads_brand_contact_idx" ON "leads"("brand", "contact");

-- CreateIndex
CREATE INDEX "leads_brand_telegram_id_idx" ON "leads"("brand", "telegram_id");

-- CreateIndex
CREATE INDEX "leads_brand_capture_prompt_chat_id_idx" ON "leads"("brand", "capture_prompt_chat_id");

-- CreateIndex
CREATE INDEX "leads_topic_id_idx" ON "leads"("topic_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE UNIQUE INDEX "leads_brand_order_id_key" ON "leads"("brand", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_pending_prompt_chat_id_pending_prompt_message_id_key" ON "leads"("pending_prompt_chat_id", "pending_prompt_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_operations_legacy_id_key" ON "ledger_operations"("legacy_id");

-- CreateIndex
CREATE INDEX "ledger_operations_created_at_idx" ON "ledger_operations"("created_at");

-- CreateIndex
CREATE INDEX "operation_prompts_created_at_idx" ON "operation_prompts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "operation_prompts_chat_id_message_id_key" ON "operation_prompts"("chat_id", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "quarantined_records_payload_hash_key" ON "quarantined_records"("payload_hash");

-- AddForeignKey
ALTER TABLE "digest_leads" ADD CONSTRAINT "digest_leads_digest_id_fkey" FOREIGN KEY ("digest_id") REFERENCES "digests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_leads" ADD CONSTRAINT "digest_leads_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
