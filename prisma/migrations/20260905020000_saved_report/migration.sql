-- Saved custom reports: an owner's named report-builder config, office-shared.
CREATE TABLE "SavedReport" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "dealerId"  TEXT,
  "name"      TEXT NOT NULL,
  "config"    JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedReport_userId_idx" ON "SavedReport"("userId");
CREATE INDEX "SavedReport_dealerId_idx" ON "SavedReport"("dealerId");
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
