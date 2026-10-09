-- Zoom cloud recordings synced from the Zoom API, with a review/publish gate.
-- Additive; dormant until Zoom credentials are configured.

CREATE TABLE "ZoomRecording" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "meetingId" TEXT,
    "topic" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 0,
    "shareUrl" TEXT NOT NULL,
    "passcode" TEXT,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "totalSize" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoomRecording_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ZoomRecording_uuid_key" ON "ZoomRecording"("uuid");
CREATE INDEX "ZoomRecording_status_startTime_idx" ON "ZoomRecording"("status", "startTime");
