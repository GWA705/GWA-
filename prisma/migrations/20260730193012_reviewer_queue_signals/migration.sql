-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "lastDealerActionAt" TIMESTAMP(3),
ADD COLUMN     "lastDealerActionKind" TEXT,
ADD COLUMN     "lastReviewerActionAt" TIMESTAMP(3);
-- Backfill: treat existing deals' submission time as the initial dealer action.
UPDATE "Application" SET "lastDealerActionAt" = "createdAt", "lastDealerActionKind" = 'SUBMITTED' WHERE "lastDealerActionAt" IS NULL;
