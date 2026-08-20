-- Per-day tally of billable outside-service calls (Google address lookups), so
-- the admin Costs page can total them by month.
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiUsage_service_day_key" ON "ApiUsage"("service", "day");
CREATE INDEX "ApiUsage_service_idx" ON "ApiUsage"("service");
