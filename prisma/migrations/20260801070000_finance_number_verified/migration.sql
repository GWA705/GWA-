-- AlterTable
ALTER TABLE "Application" ADD COLUMN "financeNumberVerifiedAt" TIMESTAMP(3),
ADD COLUMN "financeNumberVerifiedById" TEXT;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_financeNumberVerifiedById_fkey" FOREIGN KEY ("financeNumberVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
