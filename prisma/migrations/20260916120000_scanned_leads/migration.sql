-- Handwritten water-test lead cards, photographed at a Home Depot store and read
-- by the AI scanner, then confirmed + saved by a dealer or GWA staff. Separate
-- from the HD Leads Log Google Sheet; surfaced in the "Scanned leads" section.
CREATE TABLE "ScannedLead" (
  "id" TEXT NOT NULL,
  "dealerId" TEXT,
  "scannedById" TEXT,
  "scannedByName" TEXT,
  "customerName" TEXT,
  "phone" TEXT,
  "occupation" TEXT,
  "spouseName" TEXT,
  "spousePhone" TEXT,
  "spouseOccupation" TEXT,
  "address" TEXT,
  "city" TEXT,
  "postalCode" TEXT,
  "bestTimeToContact" TEXT,
  "waterNotes" TEXT,
  "ownsHome" TEXT,
  "waterSource" TEXT,
  "waterQuality" TEXT,
  "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "buysBottledWater" BOOLEAN,
  "hasFilters" BOOLEAN,
  "hasWellWater" BOOLEAN,
  "storeNumber" TEXT,
  "collectedOn" TEXT,
  "generatorName" TEXT,
  "confidence" INTEGER,
  "uncertainFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "rawJson" TEXT,
  "photoStorageKey" TEXT,
  "photoMime" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScannedLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScannedLead_dealerId_idx" ON "ScannedLead"("dealerId");
CREATE INDEX "ScannedLead_createdAt_idx" ON "ScannedLead"("createdAt");

ALTER TABLE "ScannedLead" ADD CONSTRAINT "ScannedLead_dealerId_fkey"
  FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
