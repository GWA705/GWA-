-- Personalization fields on the lead auto-text outbox (name already present).
ALTER TABLE "LeadTextOutbox" ADD COLUMN IF NOT EXISTS "street" TEXT;
ALTER TABLE "LeadTextOutbox" ADD COLUMN IF NOT EXISTS "city" TEXT;
