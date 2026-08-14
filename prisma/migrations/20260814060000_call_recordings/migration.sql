-- Customer call recordings (Bell Total Connect / Dubber, or manual upload),
-- stored encrypted and attached to the matching deal by phone number.
CREATE TABLE "CallRecording" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'dubber',
  "externalId" TEXT,
  "direction" TEXT,
  "fromNumber" TEXT,
  "toNumber" TEXT,
  "matchedPhone" TEXT,
  "startedAt" TIMESTAMP(3),
  "durationSec" INTEGER,
  "storageKey" TEXT NOT NULL,
  "mime" TEXT NOT NULL DEFAULT 'audio/mpeg',
  "sizeBytes" INTEGER,
  "transcript" TEXT,
  "applicationId" TEXT,
  "dealerId" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallRecording_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CallRecording_externalId_key" ON "CallRecording"("externalId");
CREATE INDEX "CallRecording_applicationId_idx" ON "CallRecording"("applicationId");
CREATE INDEX "CallRecording_matchedPhone_idx" ON "CallRecording"("matchedPhone");
CREATE INDEX "CallRecording_startedAt_idx" ON "CallRecording"("startedAt");
ALTER TABLE "CallRecording" ADD CONSTRAINT "CallRecording_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
