-- Per-office standardized temporary password for Home Depot ID-tag onboarding
-- emails (keeps the Entuitive screening sign-in consistent per location).
ALTER TABLE "Dealer" ADD COLUMN "idTagTempPassword" TEXT;
