-- Abbreviated product name written to the sales journal's "Product Sold" column.
-- The full name still shows everywhere in the app; this short code (e.g. "UV12")
-- is what gets written to the journal. Nullable + backfilled to NULL so existing
-- products keep writing their full name until an abbreviation is filled in.
ALTER TABLE "Product" ADD COLUMN "journalName" TEXT;
