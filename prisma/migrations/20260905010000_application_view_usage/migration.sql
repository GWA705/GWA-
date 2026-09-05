-- Applications view usage: remember a dealer's last-used view and count which
-- views are used most (Tracker / Pipeline / List / Progress).
CREATE TABLE "ApplicationViewUsage" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "dealerId"  TEXT,
  "view"      TEXT NOT NULL,
  "count"     INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationViewUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApplicationViewUsage_userId_view_key" ON "ApplicationViewUsage"("userId", "view");
CREATE INDEX "ApplicationViewUsage_dealerId_view_idx" ON "ApplicationViewUsage"("dealerId", "view");
ALTER TABLE "ApplicationViewUsage" ADD CONSTRAINT "ApplicationViewUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
