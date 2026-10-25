-- Exact attribution for who sent a deal's review request (the confirmation-team
-- report). The name column stays for rows sent before this was added.
ALTER TABLE "Application" ADD COLUMN "reviewRequestById" TEXT;

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_reviewRequestById_fkey"
  FOREIGN KEY ("reviewRequestById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Application_reviewRequestById_idx" ON "Application"("reviewRequestById");
