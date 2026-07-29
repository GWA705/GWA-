-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "approvedAmount" DECIMAL(12,2),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "financeCompanyId" TEXT;

-- CreateTable
CREATE TABLE "FinanceCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCompany_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_financeCompanyId_fkey" FOREIGN KEY ("financeCompanyId") REFERENCES "FinanceCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
