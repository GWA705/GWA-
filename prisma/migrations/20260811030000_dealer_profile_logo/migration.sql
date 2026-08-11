-- Optional office logo shown on the directory / contact card.
ALTER TABLE "DealerProfile" ADD COLUMN "logoStorageKey" TEXT;
ALTER TABLE "DealerProfile" ADD COLUMN "logoMime" TEXT;
