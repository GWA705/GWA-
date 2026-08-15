-- Contact corrections stored separately from the original journal row / portal
-- application, overlaid on display with a "last updated" stamp.
CREATE TABLE IF NOT EXISTS "CustomerContactOverride" (
  "key" TEXT NOT NULL,
  "applicationId" TEXT,
  "year" INTEGER,
  "tab" TEXT,
  "row" INTEGER,
  "customerName" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "email" TEXT,
  "updatedById" TEXT,
  "updatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerContactOverride_pkey" PRIMARY KEY ("key")
);
CREATE INDEX IF NOT EXISTS "CustomerContactOverride_applicationId_idx" ON "CustomerContactOverride"("applicationId");
