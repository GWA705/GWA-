-- Call-tracking log for HD leads (keyed to the lead's Booking ID / hash).
CREATE TABLE "LeadCall" (
  "id" TEXT NOT NULL,
  "leadKey" TEXT NOT NULL,
  "dealerId" TEXT,
  "outcome" TEXT NOT NULL,
  "note" TEXT,
  "actorId" TEXT,
  "actorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadCall_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeadCall_leadKey_idx" ON "LeadCall"("leadKey");
