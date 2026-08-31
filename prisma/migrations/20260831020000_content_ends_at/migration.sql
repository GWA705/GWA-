-- Optional end date for content items (auto-hide promotions after this date).
ALTER TABLE "ContentItem" ADD COLUMN "endsAt" TIMESTAMP(3);
