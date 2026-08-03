-- CreateTable
CREATE TABLE "MarketplaceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceCategory_active_idx" ON "MarketplaceCategory"("active");

-- AlterTable
ALTER TABLE "MarketplaceItem" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "MarketplaceItem_categoryId_idx" ON "MarketplaceItem"("categoryId");

-- AddForeignKey
ALTER TABLE "MarketplaceItem" ADD CONSTRAINT "MarketplaceItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MarketplaceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the starter categories (safe: runs once, on first apply of this migration)
INSERT INTO "MarketplaceCategory" ("id", "name", "sortOrder", "active", "createdAt", "updatedAt") VALUES
    (gen_random_uuid()::text, 'Apparel', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Signage', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Sample Kits', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Tree Hangers', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
