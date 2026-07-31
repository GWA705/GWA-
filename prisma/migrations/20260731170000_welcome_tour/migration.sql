-- Tracks when a dealer completed/dismissed the first-login welcome tour.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tourSeenAt" TIMESTAMP(3);
