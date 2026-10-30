-- Chargeback tracking on funded-deal cancellations: when GWA requested the
-- chargeback (email sent), when it completed (remittance returned it), and the
-- remittance line that settled it.

-- AlterTable
ALTER TABLE "DealCancellation"
    ADD COLUMN "chargebackRequestedAt" TIMESTAMP(3),
    ADD COLUMN "chargebackRequestedById" TEXT,
    ADD COLUMN "chargebackCompletedAt" TIMESTAMP(3),
    ADD COLUMN "chargebackLineId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DealCancellation_chargebackLineId_key" ON "DealCancellation"("chargebackLineId");

-- CreateIndex
CREATE INDEX "DealCancellation_chargebackRequestedAt_idx" ON "DealCancellation"("chargebackRequestedAt");

-- AddForeignKey
ALTER TABLE "DealCancellation" ADD CONSTRAINT "DealCancellation_chargebackRequestedById_fkey" FOREIGN KEY ("chargebackRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealCancellation" ADD CONSTRAINT "DealCancellation_chargebackLineId_fkey" FOREIGN KEY ("chargebackLineId") REFERENCES "HdRemittanceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
