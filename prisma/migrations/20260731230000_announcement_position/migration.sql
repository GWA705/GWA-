-- Where a dealer-portal sign shows: TOP (above the deals) or BOTTOM (after them).
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "position" TEXT NOT NULL DEFAULT 'TOP';
