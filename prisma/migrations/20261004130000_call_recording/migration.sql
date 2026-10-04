-- Groundwork for Twilio Voice call recordings (OFF by default — nothing writes
-- here until voice is switched on; see src/lib/voice.ts and docs/VOICE.md).
-- Additive only: one new table so a recording has a home ON THE DEAL (and so the
-- customer's profile) the moment the feature is enabled. No existing table or
-- behaviour changes.
CREATE TABLE "CallRecording" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'twilio',
    "providerCallSid" TEXT,
    "providerRecordingSid" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "durationSec" INTEGER,
    "recordingStorageKey" TEXT,
    "recordingUrl" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'confirmation',
    "startedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallRecording_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CallRecording_applicationId_idx" ON "CallRecording"("applicationId");
CREATE INDEX "CallRecording_providerCallSid_idx" ON "CallRecording"("providerCallSid");

ALTER TABLE "CallRecording"
    ADD CONSTRAINT "CallRecording_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CallRecording"
    ADD CONSTRAINT "CallRecording_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
