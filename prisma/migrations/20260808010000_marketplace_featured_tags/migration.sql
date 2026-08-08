-- Marketplace: New Arrivals (featured) + merchandising tags (New/Sale/Clearance/Popular).
-- AlterTable
ALTER TABLE "MarketplaceItem" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MarketplaceItem" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
