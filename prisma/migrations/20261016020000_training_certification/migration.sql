-- Lead-Generator training & certification. A dealer shares a public link
-- (/training/<Dealer.trainingToken>); a new lead generator completes the Home
-- Depot in-store training, passes a quiz, and signs off on the store rules. The
-- full record is kept for Home Depot compliance. No login required. Additive +
-- idempotent.

ALTER TABLE "Dealer" ADD COLUMN IF NOT EXISTS "trainingToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Dealer_trainingToken_key" ON "Dealer"("trainingToken");

CREATE TABLE IF NOT EXISTS "TrainingCertification" (
  "id" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "traineeName" TEXT NOT NULL,
  "traineeEmail" TEXT NOT NULL,
  "traineePhone" TEXT NOT NULL,
  "traineeAddress" TEXT,
  "answers" JSONB NOT NULL,
  "score" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "acknowledged" JSONB NOT NULL,
  "signatureName" TEXT NOT NULL,
  "contentVersion" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingCertification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TrainingCertification_dealerId_idx" ON "TrainingCertification"("dealerId");
CREATE INDEX IF NOT EXISTS "TrainingCertification_createdAt_idx" ON "TrainingCertification"("createdAt");

DO $$ BEGIN
  ALTER TABLE "TrainingCertification"
    ADD CONSTRAINT "TrainingCertification_dealerId_fkey"
    FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
