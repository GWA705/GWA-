-- Richer office details on the new-dealer intake.
ALTER TABLE "OnboardRequest" ADD COLUMN "legalName" TEXT;
ALTER TABLE "OnboardRequest" ADD COLUMN "officePhone" TEXT;
ALTER TABLE "OnboardRequest" ADD COLUMN "officeEmail" TEXT;
ALTER TABLE "OnboardRequest" ADD COLUMN "address" TEXT;
ALTER TABLE "OnboardRequest" ADD COLUMN "province" TEXT;
ALTER TABLE "OnboardRequest" ADD COLUMN "postal" TEXT;
ALTER TABLE "OnboardRequest" ADD COLUMN "mailingAddress" TEXT;
ALTER TABLE "OnboardRequest" ADD COLUMN "logoStorageKey" TEXT;
ALTER TABLE "OnboardRequest" ADD COLUMN "logoMime" TEXT;
