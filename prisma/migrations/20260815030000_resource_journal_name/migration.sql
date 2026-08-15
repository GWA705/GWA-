-- Short-form journal name(s) for a resource-library product, so it matches the
-- product short forms dealers select when entering a deal.
ALTER TABLE "ResourceProduct" ADD COLUMN IF NOT EXISTS "journalName" TEXT;
