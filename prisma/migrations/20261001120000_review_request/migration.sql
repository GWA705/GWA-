-- Post-job customer review request: record the last send so staff don't
-- double-send and can see it went out. All nullable; display-only.
ALTER TABLE "Application" ADD COLUMN "reviewRequestSentAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "reviewRequestVia" TEXT;
ALTER TABLE "Application" ADD COLUMN "reviewRequestByName" TEXT;
