-- Optional custom cover thumbnail for a content item.
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "thumbStorageKey" TEXT;
ALTER TABLE "ContentItem" ADD COLUMN IF NOT EXISTS "thumbMime" TEXT;
