-- Dealer business/compliance documents (WSIB, WCB, etc.) with expiry tracking.
CREATE TABLE IF NOT EXISTS "DealerDocument" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "accountNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "scannedDates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "autoExtracted" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastRemindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DealerDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DealerDocument_dealerId_idx" ON "DealerDocument"("dealerId");
CREATE INDEX IF NOT EXISTS "DealerDocument_expiryDate_idx" ON "DealerDocument"("expiryDate");

DO $$ BEGIN
  ALTER TABLE "DealerDocument" ADD CONSTRAINT "DealerDocument_dealerId_fkey"
    FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DealerDocument" ADD CONSTRAINT "DealerDocument_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
