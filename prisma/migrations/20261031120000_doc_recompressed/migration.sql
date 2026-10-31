-- One-off resolution-cap backfill marker: when the "shrink stored scans" sweep
-- has processed a document (shrunk it, or deliberately left it alone), so the
-- portal-wide sweep never reprocesses an un-shrinkable file in a loop.

-- AlterTable
ALTER TABLE "Document"
    ADD COLUMN "recompressedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Document_recompressedAt_sizeBytes_idx" ON "Document"("recompressedAt", "sizeBytes");
