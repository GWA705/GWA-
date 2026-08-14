-- Per-user preference: push when a new HD lead lands for the dealer's office.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyNewLeads" BOOLEAN NOT NULL DEFAULT true;

-- Dedupe ledger so each lead is pushed to its dealer exactly once.
CREATE TABLE IF NOT EXISTS "LeadNotified" (
  "leadKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadNotified_pkey" PRIMARY KEY ("leadKey")
);
