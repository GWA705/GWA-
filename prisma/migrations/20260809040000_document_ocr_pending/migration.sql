-- Tier-2 OCR queue flag: a scanned/photo document awaiting text extraction.
ALTER TABLE "Document" ADD COLUMN "ocrPending" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Document_ocrPending_idx" ON "Document" ("ocrPending");
