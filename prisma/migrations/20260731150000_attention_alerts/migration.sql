-- Reviewer opt-out for the 2-hour "new deal not looked at" alert.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyAttentionAlerts" BOOLEAN NOT NULL DEFAULT true;

-- Tracks when the 2-hour attention alert was last sent for a deal, so it
-- re-sends at most once per ~2h window rather than every cron run.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "attentionAlertSentAt" TIMESTAMP(3);
