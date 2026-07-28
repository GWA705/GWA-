-- CreateEnum
CREATE TYPE "EntryMethod" AS ENUM ('TYPED', 'PHOTO', 'FINANCEIT');

-- CreateEnum
CREATE TYPE "HousingStatus" AS ENUM ('OWN', 'RENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('EMPLOYED', 'SELF_EMPLOYED', 'OTHER');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "entryMethod" "EntryMethod" NOT NULL DEFAULT 'TYPED';

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "middleName" TEXT,
    "homePhone" TEXT,
    "maritalStatus" TEXT,
    "housingStatus" "HousingStatus",
    "monthlyHousingCost" DECIMAL(10,2),
    "yearsAtAddress" INTEGER,
    "city" TEXT,
    "addressProvince" TEXT,
    "postalCode" TEXT,
    "mailingAddress" TEXT,
    "mailingCity" TEXT,
    "mailingProvince" TEXT,
    "mailingPostal" TEXT,
    "previousAddress" TEXT,
    "previousCity" TEXT,
    "previousProvince" TEXT,
    "previousPostal" TEXT,
    "worksiteAddress" TEXT,
    "worksiteCity" TEXT,
    "worksiteProvince" TEXT,
    "worksitePostal" TEXT,
    "idType" TEXT,
    "idProvince" TEXT,
    "idExpiry" TIMESTAMP(3),
    "businessName" TEXT,
    "positionTitle" TEXT,
    "employerAddress" TEXT,
    "employerPhone" TEXT,
    "grossMonthlyIncome" DECIMAL(12,2),
    "timeAtJobYears" INTEGER,
    "employmentStatus" "EmploymentStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanApplication_applicationId_key" ON "LoanApplication"("applicationId");

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
