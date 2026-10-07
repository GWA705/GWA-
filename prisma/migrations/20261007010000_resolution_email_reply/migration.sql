-- HD Case # matching + "awaiting reply" (Phase 3b-2 tweak). Additive:
-- - ResolutionCase.hdCaseNumber: HD's resolution CASE # (what their emails are keyed by).
-- - ResolutionEmail.inbound: whether the message is from HD (not us) — drives the
--   "awaiting your reply" signal.
ALTER TABLE "ResolutionCase" ADD COLUMN "hdCaseNumber" TEXT;
ALTER TABLE "ResolutionEmail" ADD COLUMN "inbound" BOOLEAN NOT NULL DEFAULT true;
