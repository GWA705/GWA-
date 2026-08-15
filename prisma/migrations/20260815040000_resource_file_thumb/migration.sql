-- First-page PDF preview thumbnails for resource files (webp), so a thumbnail
-- renders on every device including mobile.
ALTER TABLE "ResourceProductFile" ADD COLUMN IF NOT EXISTS "thumbStorageKey" TEXT;
ALTER TABLE "ResourceProductFile" ADD COLUMN IF NOT EXISTS "thumbMime" TEXT;
