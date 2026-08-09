-- Part / SKU number for marketplace items, snapshotted onto each order line so
-- the fulfillment email can show what to pull. Not shown to dealers.
ALTER TABLE "MarketplaceItem" ADD COLUMN "partNumber" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "partNumber" TEXT;
