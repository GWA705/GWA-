-- Follow-up text sequence: a message kind per outbox row (CONFIRM / DAY1 /
-- MISSED_WINDOW). Additive, safe on a live table. Existing rows are CONFIRM.
ALTER TABLE "LeadTextOutbox" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'CONFIRM';
