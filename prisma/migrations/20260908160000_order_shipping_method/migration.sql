-- Shipping method chosen by the dealer at checkout (shown to the shipper).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingMethod" TEXT;
