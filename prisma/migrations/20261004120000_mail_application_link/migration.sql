-- Mail can now deep-link to a specific deal. A confirmation-issue mail carries
-- the deal's id so the dealer can open that exact customer's profile straight
-- from the message. Nullable; null = a general/broadcast mail not tied to a deal.
-- ON DELETE SET NULL so removing a deal never deletes the mail record.
ALTER TABLE "Mail" ADD COLUMN "applicationId" TEXT;

ALTER TABLE "Mail"
  ADD CONSTRAINT "Mail_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Mail_applicationId_idx" ON "Mail"("applicationId");
