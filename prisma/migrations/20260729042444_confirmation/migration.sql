-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('PENDING', 'COMPLETED', 'ISSUE');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "Confirmation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "productName" TEXT,
    "numberOfCalls" INTEGER,
    "city" TEXT,
    "district" TEXT,
    "phoneNumber" TEXT,
    "installedWorking" BOOLEAN NOT NULL DEFAULT false,
    "performingAsRepresented" BOOLEAN NOT NULL DEFAULT false,
    "receivedEverything" BOOLEAN NOT NULL DEFAULT false,
    "financingAmount" DECIMAL(12,2),
    "termMonths" INTEGER,
    "firstInstallmentAmount" DECIMAL(12,2),
    "firstInstallmentDate" TIMESTAMP(3),
    "termsAgreed" BOOLEAN NOT NULL DEFAULT false,
    "signatureConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "notTrialOffer" BOOLEAN NOT NULL DEFAULT false,
    "specialArrangements" TEXT,
    "hdNotes" TEXT,
    "issueNote" TEXT,
    "confirmedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Confirmation_applicationId_key" ON "Confirmation"("applicationId");

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
