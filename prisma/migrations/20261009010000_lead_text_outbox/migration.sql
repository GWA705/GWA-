-- Customer auto-text ("we received your request") queue + dedupe ledger, and
-- the SMS opt-out ledger. Additive; everything stays dormant until the feature
-- is enabled in settings.

CREATE TABLE "LeadTextOutbox" (
    "leadKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "dealerId" TEXT,
    "province" TEXT,
    "phone" TEXT NOT NULL,
    "customerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "channel" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "twilioSid" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTextOutbox_pkey" PRIMARY KEY ("leadKey")
);

CREATE INDEX "LeadTextOutbox_status_scheduledFor_idx" ON "LeadTextOutbox"("status", "scheduledFor");

CREATE TABLE "SmsOptOut" (
    "phone" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOptOut_pkey" PRIMARY KEY ("phone")
);
