-- Per-office insights digest: opt-in flag + send log (dedupe).
ALTER TABLE "Dealer" ADD COLUMN "insightsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DigestLog" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DigestLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DigestLog_dealerId_periodKey_key" ON "DigestLog"("dealerId", "periodKey");
CREATE INDEX "DigestLog_sentAt_idx" ON "DigestLog"("sentAt");
