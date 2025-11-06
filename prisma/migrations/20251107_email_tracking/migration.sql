-- CreateTable for email bounces tracking
CREATE TABLE "email_bounces" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "bounce_type" VARCHAR(10) NOT NULL,
    "reason" TEXT,
    "raw_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_bounces_pkey" PRIMARY KEY ("id")
);

-- CreateTable for internal blocked emails
CREATE TABLE "blocked_emails" (
    "email" VARCHAR(255) NOT NULL,
    "reason" TEXT,
    "bounce_count" INTEGER NOT NULL DEFAULT 0,
    "last_bounce_at" TIMESTAMP(3),
    "blocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblocked_at" TIMESTAMP(3),
    "unblocked_by" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "blocked_emails_pkey" PRIMARY KEY ("email")
);

-- CreateTable for email send logs
CREATE TABLE "email_send_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "recipient_email" VARCHAR(255) NOT NULL,
    "sender_email" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500),
    "template_type" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL,
    "ncp_message_id" VARCHAR(255),
    "error_message" TEXT,
    "error_code" VARCHAR(50),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),

    CONSTRAINT "email_send_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for performance
CREATE INDEX "email_bounces_email_idx" ON "email_bounces"("email");
CREATE INDEX "email_bounces_created_at_idx" ON "email_bounces"("created_at");
CREATE INDEX "email_bounces_bounce_type_idx" ON "email_bounces"("bounce_type");

CREATE INDEX "blocked_emails_is_active_idx" ON "blocked_emails"("is_active");
CREATE INDEX "blocked_emails_blocked_at_idx" ON "blocked_emails"("blocked_at");

CREATE INDEX "email_send_logs_recipient_email_idx" ON "email_send_logs"("recipient_email");
CREATE INDEX "email_send_logs_status_idx" ON "email_send_logs"("status");
CREATE INDEX "email_send_logs_sent_at_idx" ON "email_send_logs"("sent_at");
CREATE INDEX "email_send_logs_ncp_message_id_idx" ON "email_send_logs"("ncp_message_id");

-- Add comment for documentation
COMMENT ON TABLE "email_bounces" IS 'NCP 이메일 바운스 추적';
COMMENT ON TABLE "blocked_emails" IS '내부 이메일 차단 목록';
COMMENT ON TABLE "email_send_logs" IS '이메일 발송 로그';

COMMENT ON COLUMN "email_bounces"."bounce_type" IS 'hard, soft, complaint, unsubscribe';
COMMENT ON COLUMN "email_send_logs"."status" IS 'pending, sent, delivered, failed, bounced, blocked';
COMMENT ON COLUMN "email_send_logs"."template_type" IS 'otp, password_reset, approval, rejection, alert';