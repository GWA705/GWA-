-- Mirror of the booking system's status for a scanned lead, pushed back by the
-- booking app so the office sees the bookers' progress inside the portal.
ALTER TABLE "ScannedLead" ADD COLUMN IF NOT EXISTS "bookingStatus" TEXT;
ALTER TABLE "ScannedLead" ADD COLUMN IF NOT EXISTS "bookingStatusAt" TIMESTAMP(3);
