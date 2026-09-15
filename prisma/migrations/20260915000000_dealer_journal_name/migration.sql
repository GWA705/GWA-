-- Short form of the dealer's name written to the sales journal's "Location"
-- column (e.g. "Georgian Water and Air" -> "GWA"). The full name still shows
-- everywhere in the app; this override is only what gets written to the journal.
-- Nullable + backfilled to NULL so existing dealers keep writing their full name
-- until a journal name is filled in. Mirrors Product.journalName.
ALTER TABLE "Dealer" ADD COLUMN "journalName" TEXT;
