-- Record which dealer an intake was attached to, so its office details can be
-- backfilled into the Office Directory profile later.
ALTER TABLE "OnboardRequest" ADD COLUMN "attachedDealerId" TEXT;
