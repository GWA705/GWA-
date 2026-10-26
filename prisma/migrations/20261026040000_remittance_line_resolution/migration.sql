-- Chargeback/fee tracking: mark when a Home Depot clawback has been settled, with
-- a reference, so the office can track and look it up later.
ALTER TABLE "HdRemittanceLine" ADD COLUMN IF NOT EXISTS "resolvedAt"   TIMESTAMP(3);
ALTER TABLE "HdRemittanceLine" ADD COLUMN IF NOT EXISTS "resolvedRef"  TEXT;
ALTER TABLE "HdRemittanceLine" ADD COLUMN IF NOT EXISTS "resolvedNote" TEXT;
ALTER TABLE "HdRemittanceLine" ADD COLUMN IF NOT EXISTS "resolvedById" TEXT;

CREATE INDEX IF NOT EXISTS "HdRemittanceLine_status_idx" ON "HdRemittanceLine" ("status");
