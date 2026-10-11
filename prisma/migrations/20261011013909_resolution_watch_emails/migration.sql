-- Additional email addresses to parse into a resolution case (customer personal
-- email, extra HD contacts). The customer email is watched automatically.
ALTER TABLE "ResolutionCase" ADD COLUMN IF NOT EXISTS "watchEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
