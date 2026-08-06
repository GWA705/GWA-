-- Split / multi-method payments: a deal total can be divided across up to three
-- payment lines; the financing lines make up the financed amount.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'FINANCE_COMPANY';

ALTER TABLE "Application" ADD COLUMN "isSplitPayment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN "financedAmount" DECIMAL(12,2);

CREATE TABLE "PaymentSplit" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentSplit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentSplit_applicationId_idx" ON "PaymentSplit"("applicationId");
ALTER TABLE "PaymentSplit" ADD CONSTRAINT "PaymentSplit_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
