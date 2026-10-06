-- Resolution email-thread link (Phase 3b-2). Additive: three nullable columns on
-- ResolutionCase + one new table mirroring the linked Gmail thread's messages.
-- Inert until the Gmail integration is configured (GMAIL_RESOLUTION_USER +
-- read-only delegation on the existing service account).

ALTER TABLE "ResolutionCase" ADD COLUMN "gmailThreadId" TEXT;
ALTER TABLE "ResolutionCase" ADD COLUMN "gmailLinkedAt" TIMESTAMP(3);
ALTER TABLE "ResolutionCase" ADD COLUMN "emailSyncedAt" TIMESTAMP(3);

CREATE TABLE "ResolutionEmail" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "fromAddr" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "snippet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolutionEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResolutionEmail_caseId_gmailMessageId_key" ON "ResolutionEmail"("caseId", "gmailMessageId");
CREATE INDEX "ResolutionEmail_caseId_idx" ON "ResolutionEmail"("caseId");

ALTER TABLE "ResolutionEmail"
    ADD CONSTRAINT "ResolutionEmail_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "ResolutionCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
