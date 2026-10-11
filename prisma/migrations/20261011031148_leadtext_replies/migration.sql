-- Reply tracking on the lead auto-text outbox (for the performance report).
ALTER TABLE "LeadTextOutbox" ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3);
ALTER TABLE "LeadTextOutbox" ADD COLUMN IF NOT EXISTS "replyText" TEXT;
