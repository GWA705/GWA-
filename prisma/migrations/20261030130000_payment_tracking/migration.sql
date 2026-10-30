-- Payment tracking: customer card/deposit status + office payment to Home Depot.

-- CreateEnum
CREATE TYPE "CardPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'NEEDS_AUTH', 'DECLINED');

-- CreateEnum
CREATE TYPE "OfficeCard" AS ENUM ('SEAN', 'JJ');

-- AlterTable
ALTER TABLE "Application"
    ADD COLUMN "cardPaymentStatus" "CardPaymentStatus",
    ADD COLUMN "cardPaymentNote" TEXT,
    ADD COLUMN "cardPaymentStatusAt" TIMESTAMP(3),
    ADD COLUMN "cardPaymentStatusById" TEXT,
    ADD COLUMN "hdPaidCard" "OfficeCard",
    ADD COLUMN "hdPaidAmount" DECIMAL(12,2),
    ADD COLUMN "hdPaidOn" TIMESTAMP(3),
    ADD COLUMN "hdPaidAt" TIMESTAMP(3),
    ADD COLUMN "hdPaidById" TEXT;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_cardPaymentStatusById_fkey" FOREIGN KEY ("cardPaymentStatusById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_hdPaidById_fkey" FOREIGN KEY ("hdPaidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
