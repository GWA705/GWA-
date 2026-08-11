-- Optional logo/photo per support contact card.
ALTER TABLE "SupportContact" ADD COLUMN "logoStorageKey" TEXT;
ALTER TABLE "SupportContact" ADD COLUMN "logoMime" TEXT;
