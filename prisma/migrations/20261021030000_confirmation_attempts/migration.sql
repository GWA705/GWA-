-- Structured confirmation-call attempts (the tap-to-log confirmer flow). Additive:
-- one row per attempt with an outcome + the confirmer, replacing hand-typed call
-- dates so attempts / reach-rate / days-to-confirm are countable.
CREATE TABLE "ConfirmationAttempt" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConfirmationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConfirmationAttempt_applicationId_idx" ON "ConfirmationAttempt"("applicationId");

ALTER TABLE "ConfirmationAttempt" ADD CONSTRAINT "ConfirmationAttempt_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConfirmationAttempt" ADD CONSTRAINT "ConfirmationAttempt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
