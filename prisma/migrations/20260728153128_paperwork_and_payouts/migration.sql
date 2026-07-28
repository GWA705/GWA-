-- AlterEnum
ALTER TYPE "DocumentStage" ADD VALUE 'REVIEWER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'HD_PAPERWORK';
ALTER TYPE "DocumentType" ADD VALUE 'FINANCING_PAPERWORK';

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payout_applicationId_idx" ON "Payout"("applicationId");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
