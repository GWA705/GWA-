-- Sales-journal detail fields on a deal (dealer-entered + reviewer datePaid).
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "leadGenerator" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "salespersonName" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "installerName" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "soapIncluded" BOOLEAN;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "productsSold" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "datePaid" TIMESTAMP(3);

-- Admin-managed product catalog (powers the dealer multi-select).
CREATE TABLE IF NOT EXISTS "Product" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
