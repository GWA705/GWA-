-- Per-option part numbers for marketplace items (index-aligned with "options").
ALTER TABLE "MarketplaceItem" ADD COLUMN IF NOT EXISTS "optionSkus" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
