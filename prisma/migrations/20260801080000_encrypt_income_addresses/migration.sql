-- Add encrypted columns for income + secondary/employer addresses. Plaintext
-- columns are kept during the transition (backfilled + nulled by the seed
-- script) and dropped in a later migration.

-- Application
ALTER TABLE "Application" ADD COLUMN "incomeAnnualEnc" TEXT;

-- LoanApplication
ALTER TABLE "LoanApplication" ADD COLUMN "monthlyHousingCostEnc" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN "mailingAddressEnc" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN "previousAddressEnc" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN "worksiteAddressEnc" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN "employerAddressEnc" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN "grossMonthlyIncomeEnc" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN "coEmployerAddressEnc" TEXT;
ALTER TABLE "LoanApplication" ADD COLUMN "coGrossMonthlyIncomeEnc" TEXT;
