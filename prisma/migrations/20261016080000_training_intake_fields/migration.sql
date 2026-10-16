-- Richer trainee intake on the Lead Gen Training: city, postal code, and the
-- trainee's start date. Additive and idempotent.
ALTER TABLE "TrainingCertification" ADD COLUMN IF NOT EXISTS "traineeCity" TEXT;
ALTER TABLE "TrainingCertification" ADD COLUMN IF NOT EXISTS "traineePostal" TEXT;
ALTER TABLE "TrainingCertification" ADD COLUMN IF NOT EXISTS "startDate" TEXT;
