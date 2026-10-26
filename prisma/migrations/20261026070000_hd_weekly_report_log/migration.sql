-- One row per weekly report actually sent, so a re-run (cron + manual) never
-- double-sends. storeNumber is '' for the National summary.
CREATE TABLE IF NOT EXISTS "HdWeeklyReportLog" (
  "id"             TEXT PRIMARY KEY,
  "weekStart"      TIMESTAMP(3) NOT NULL,
  "kind"           TEXT NOT NULL,
  "storeNumber"    TEXT NOT NULL DEFAULT '',
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "HdWeeklyReportLog_week_kind_store_key"
  ON "HdWeeklyReportLog" ("weekStart", "kind", "storeNumber");
