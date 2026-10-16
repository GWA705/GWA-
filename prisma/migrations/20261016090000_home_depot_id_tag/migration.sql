-- Home Depot ID tag submissions (gated/nudged on training certificate).

DO $$ BEGIN
  CREATE TYPE "IdTagKind" AS ENUM ('NEW', 'EXISTING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IdTagStatus" AS ENUM (
    'AWAITING_TRAINING', 'SUBMITTED', 'BACKGROUND_CHECK', 'APPROVED',
    'TAG_ISSUED', 'ACTIVE', 'ON_HOLD', 'NOT_PROCEEDING'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "HomeDepotIdTag" (
  "id"              TEXT NOT NULL,
  "dealerId"        TEXT NOT NULL,
  "personName"      TEXT NOT NULL,
  "personEmail"     TEXT,
  "personPhone"     TEXT,
  "kind"            "IdTagKind" NOT NULL DEFAULT 'NEW',
  "status"          "IdTagStatus" NOT NULL DEFAULT 'AWAITING_TRAINING',
  "certificationId" TEXT,
  "submittedById"   TEXT,
  "emailSentAt"     TIMESTAMP(3),
  "note"            TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomeDepotIdTag_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HomeDepotIdTag_dealerId_idx" ON "HomeDepotIdTag"("dealerId");
CREATE INDEX IF NOT EXISTS "HomeDepotIdTag_status_idx" ON "HomeDepotIdTag"("status");
CREATE INDEX IF NOT EXISTS "HomeDepotIdTag_createdAt_idx" ON "HomeDepotIdTag"("createdAt");

DO $$ BEGIN
  ALTER TABLE "HomeDepotIdTag" ADD CONSTRAINT "HomeDepotIdTag_dealerId_fkey"
    FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
