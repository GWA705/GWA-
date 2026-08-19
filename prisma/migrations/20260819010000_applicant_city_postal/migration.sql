-- Persist city + postal on the Application itself (not only inside the
-- typed-entry loanApplication), so Express/Photo deals keep them and the
-- sales-journal write can fill the City and Postal Code columns for every deal.
ALTER TABLE "Application" ADD COLUMN "applicantCity" TEXT;
ALTER TABLE "Application" ADD COLUMN "applicantPostal" TEXT;

-- Backfill existing typed deals from their loan application so nothing regresses.
UPDATE "Application" a
SET "applicantCity" = l."city",
    "applicantPostal" = l."postalCode"
FROM "LoanApplication" l
WHERE l."applicationId" = a."id"
  AND (a."applicantCity" IS NULL OR a."applicantPostal" IS NULL);
