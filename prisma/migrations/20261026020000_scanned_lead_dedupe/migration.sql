-- Duplicate guard for scanned leads: a normalised key so the same card can't be
-- scanned in twice. The app computes this on save (src/lib/scannedLeadDedupe.ts);
-- this backfill uses the IDENTICAL normalisation so existing leads are caught too.
-- A plain (non-unique) index — the block is enforced in the app, so this can
-- never fail a deploy on data that already contains duplicates.

ALTER TABLE "ScannedLead" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

-- Backfill existing rows. Mirrors scannedLeadDedupeKey():
--   phone digits ≥ 7  → 'p:' + last 10 digits
--   else name present → 'n:' + lower(collapsed name) + '|s:' + store
--   else              → NULL
UPDATE "ScannedLead" s
SET "dedupeKey" = CASE
    WHEN length(regexp_replace(COALESCE(s."phone", ''), '[^0-9]', '', 'g')) >= 7
      THEN 'p:' || RIGHT(regexp_replace(COALESCE(s."phone", ''), '[^0-9]', '', 'g'), 10)
    WHEN lower(btrim(regexp_replace(COALESCE(s."customerName", ''), '\s+', ' ', 'g'))) <> ''
      THEN 'n:' || lower(btrim(regexp_replace(COALESCE(s."customerName", ''), '\s+', ' ', 'g')))
           || '|s:' || btrim(COALESCE(s."storeNumber", ''))
    ELSE NULL
  END;

CREATE INDEX IF NOT EXISTS "ScannedLead_dedupeKey_idx" ON "ScannedLead" ("dedupeKey");
