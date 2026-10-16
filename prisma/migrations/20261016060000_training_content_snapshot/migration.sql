-- Store the exact quiz + rules a trainee saw, plus the language they completed
-- in, so each certificate renders faithfully even after an admin edits the
-- program. Additive and idempotent.
ALTER TABLE "TrainingCertification" ADD COLUMN IF NOT EXISTS "contentSnapshot" JSONB;
ALTER TABLE "TrainingCertification" ADD COLUMN IF NOT EXISTS "language" TEXT;
