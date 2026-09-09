-- Home Depot remittance intake: records HD payments and matches them to deals.
DO $$ BEGIN CREATE TYPE "RemittanceSource" AS ENUM ('WEBHOOK', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "RemittanceLineStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'CHARGEBACK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "HdRemittance" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT,
    "documentDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "totalNet" DECIMAL(12,2),
    "source" "RemittanceSource" NOT NULL DEFAULT 'WEBHOOK',
    "processedById" TEXT,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "chargebackCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HdRemittance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HdRemittance_documentNumber_key" ON "HdRemittance"("documentNumber");
CREATE INDEX IF NOT EXISTS "HdRemittance_paymentDate_idx" ON "HdRemittance"("paymentDate");

CREATE TABLE IF NOT EXISTS "HdRemittanceLine" (
    "id" TEXT NOT NULL,
    "remittanceId" TEXT NOT NULL,
    "hdIdNumber" TEXT NOT NULL,
    "customerName" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "invoiceDate" TIMESTAMP(3),
    "isChargeback" BOOLEAN NOT NULL DEFAULT false,
    "status" "RemittanceLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "applicationId" TEXT,
    "fundedNow" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HdRemittanceLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HdRemittanceLine_remittanceId_idx" ON "HdRemittanceLine"("remittanceId");
CREATE INDEX IF NOT EXISTS "HdRemittanceLine_hdIdNumber_idx" ON "HdRemittanceLine"("hdIdNumber");
CREATE INDEX IF NOT EXISTS "HdRemittanceLine_applicationId_idx" ON "HdRemittanceLine"("applicationId");

DO $$ BEGIN
  ALTER TABLE "HdRemittance" ADD CONSTRAINT "HdRemittance_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "HdRemittanceLine" ADD CONSTRAINT "HdRemittanceLine_remittanceId_fkey" FOREIGN KEY ("remittanceId") REFERENCES "HdRemittance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "HdRemittanceLine" ADD CONSTRAINT "HdRemittanceLine_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
