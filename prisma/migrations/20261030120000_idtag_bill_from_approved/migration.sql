-- HD ID-tag billing now counts a rep from APPROVED onward (not only TAG_ISSUED /
-- ACTIVE), since the $35 + tax is incurred when Entuitive clears the screening.
-- Backfill activatedAt for reps already at Approved / Tag issued / Active that
-- were never stamped, using updatedAt as the best available "became billable"
-- date, so past approvals appear on their month's invoice. Idempotent: only
-- rows with a null activatedAt are touched.
UPDATE "HomeDepotIdTag"
SET "activatedAt" = "updatedAt"
WHERE "activatedAt" IS NULL
  AND "status" IN ('APPROVED', 'TAG_ISSUED', 'ACTIVE');
