-- Read-back from the sales journal: reflect a deal's settlement (Result "OK" +
-- Date Paid) so the portal can auto-advance it to Funded/Paid.
ALTER TABLE "Application" ADD COLUMN "journalResult" TEXT;
ALTER TABLE "Application" ADD COLUMN "journalPaidOn" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "journalCheckedAt" TIMESTAMP(3);
