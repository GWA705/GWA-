-- Mark deals that were materialized from an existing sales-journal row (a sale
-- typed straight into the sheet) so an HD Resolution reviewer can link the
-- customer's file. These are excluded from the pipeline/review queues and the
-- Application-based reports; money reports read the journal directly, so dollar
-- totals are unaffected. Additive + idempotent.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "journalSourced" BOOLEAN NOT NULL DEFAULT false;
