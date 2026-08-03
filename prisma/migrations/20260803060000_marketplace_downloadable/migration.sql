-- AlterTable: add downloadable-file support to marketplace items
ALTER TABLE "MarketplaceItem"
    ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'ORDER',
    ADD COLUMN "fileStorageKey" TEXT,
    ADD COLUMN "fileName" TEXT,
    ADD COLUMN "fileMime" TEXT,
    ADD COLUMN "fileSizeBytes" INTEGER;
