-- Dealer-initiated deal cancellations, confirmed by a reviewer before they finalize.
DO $$ BEGIN
  CREATE TYPE "CancellationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DealCancellation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "priorStatus" "ApplicationStatus" NOT NULL,
    "wasFunded" BOOLEAN NOT NULL DEFAULT false,
    "uninstallDate" TIMESTAMP(3),
    "status" "CancellationStatus" NOT NULL DEFAULT 'PENDING',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "reviewerNote" TEXT,
    "hdRefundConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DealCancellation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DealCancellation_applicationId_idx" ON "DealCancellation"("applicationId");
CREATE INDEX IF NOT EXISTS "DealCancellation_status_idx" ON "DealCancellation"("status");

DO $$ BEGIN
  ALTER TABLE "DealCancellation" ADD CONSTRAINT "DealCancellation_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DealCancellation" ADD CONSTRAINT "DealCancellation_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DealCancellation" ADD CONSTRAINT "DealCancellation_handledById_fkey"
    FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
