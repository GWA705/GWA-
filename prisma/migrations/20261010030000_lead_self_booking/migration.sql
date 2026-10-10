-- Customer self-booking (Phase 2): a tokenized public page where the customer
-- requests their preferred time; a booker still confirms. Additive.
ALTER TABLE "ScannedLead" ADD COLUMN IF NOT EXISTS "bookingToken" TEXT;
ALTER TABLE "ScannedLead" ADD COLUMN IF NOT EXISTS "bookingRequestedAt" TIMESTAMP(3);
ALTER TABLE "ScannedLead" ADD COLUMN IF NOT EXISTS "bookingPreferredDay" TEXT;
ALTER TABLE "ScannedLead" ADD COLUMN IF NOT EXISTS "bookingWindow" TEXT;
ALTER TABLE "ScannedLead" ADD COLUMN IF NOT EXISTS "bookingCallNow" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ScannedLead" ADD COLUMN IF NOT EXISTS "bookingNote" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ScannedLead_bookingToken_key" ON "ScannedLead"("bookingToken");
