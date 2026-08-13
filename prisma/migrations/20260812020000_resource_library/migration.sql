-- Product resource library: standalone catalog of products with a photo and any
-- number of typed files (manuals, brochures, spec sheets, warranties, …).
CREATE TYPE "ResourceFileKind" AS ENUM ('MANUAL', 'BROCHURE', 'SPEC_SHEET', 'WARRANTY', 'OTHER');

CREATE TABLE "ResourceProduct" (
  "id"              TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "category"        TEXT,
  "brand"           TEXT,
  "modelNumber"     TEXT,
  "description"     TEXT,
  "imageStorageKey" TEXT,
  "imageMime"       TEXT,
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResourceProduct_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ResourceProduct_active_sortOrder_idx" ON "ResourceProduct"("active", "sortOrder");

CREATE TABLE "ResourceProductFile" (
  "id"           TEXT NOT NULL,
  "productId"    TEXT NOT NULL,
  "kind"         "ResourceFileKind" NOT NULL DEFAULT 'OTHER',
  "label"        TEXT,
  "storageKey"   TEXT NOT NULL,
  "mime"         TEXT NOT NULL,
  "sizeBytes"    INTEGER NOT NULL,
  "originalName" TEXT,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceProductFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ResourceProductFile_productId_idx" ON "ResourceProductFile"("productId");
ALTER TABLE "ResourceProductFile" ADD CONSTRAINT "ResourceProductFile_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "ResourceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
