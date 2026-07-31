-- Google Sheets sales-journal sync ("Write to Journal"). Remembers which month
-- tab and row a deal was written to, so re-writing updates the same row instead
-- of appending a duplicate.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "journalTab" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "journalRow" INTEGER;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "journalSyncedAt" TIMESTAMP(3);
