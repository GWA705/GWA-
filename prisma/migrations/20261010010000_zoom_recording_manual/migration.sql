-- Manual Zoom recording adds (recordings not in Zoom's cloud): a pasted link or
-- a video uploaded straight to S3. Additive, safe on a live table.
ALTER TABLE "ZoomRecording" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'ZOOM';
ALTER TABLE "ZoomRecording" ADD COLUMN IF NOT EXISTS "fileKey" TEXT;
ALTER TABLE "ZoomRecording" ADD COLUMN IF NOT EXISTS "fileType" TEXT;
