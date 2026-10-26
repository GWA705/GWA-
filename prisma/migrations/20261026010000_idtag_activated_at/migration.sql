-- When a rep first became active (TAG_ISSUED/ACTIVE) — the billable event.
ALTER TABLE "HomeDepotIdTag" ADD COLUMN "activatedAt" TIMESTAMP(3);

-- Backfill: treat already-active/issued reps as activated at their last update
-- so existing data shows up in billing history.
UPDATE "HomeDepotIdTag"
   SET "activatedAt" = "updatedAt"
 WHERE "activatedAt" IS NULL
   AND "status" IN ('TAG_ISSUED', 'ACTIVE');
