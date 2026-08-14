-- "My paperwork is done" marker for the reviewer on the awaiting-install step.
-- Team signal only; does not change the deal status.
ALTER TABLE "Application" ADD COLUMN "reviewerDoneAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "reviewerDoneByName" TEXT;
