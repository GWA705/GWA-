-- Escalating dealer reminders for idle deals.

-- Dealer notification preference (defaults on).
ALTER TABLE "User" ADD COLUMN "notifyIdleReminders" BOOLEAN NOT NULL DEFAULT true;

-- Log of each reminder sent, so the cadence engine can enforce the per-day cap,
-- the every-other-day step-down, and the twice-a-week tail without re-sending.
CREATE TABLE "DealerReminder" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "emailedCount" INTEGER NOT NULL DEFAULT 0,
    "pushedCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DealerReminder_applicationId_sentAt_idx" ON "DealerReminder"("applicationId", "sentAt");
CREATE INDEX "DealerReminder_sentAt_idx" ON "DealerReminder"("sentAt");

ALTER TABLE "DealerReminder" ADD CONSTRAINT "DealerReminder_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
