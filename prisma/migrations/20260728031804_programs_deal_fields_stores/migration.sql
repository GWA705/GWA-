/*
  Warnings:

  - You are about to drop the column `program` on the `Application` table. All the data in the column will be lost.
  - Added the required column `programCategory` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `programType` to the `Application` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('HD', 'GWA');

-- CreateEnum
CREATE TYPE "ProgramCategory" AS ENUM ('WATER', 'AIR', 'SMELL_BUSTERS', 'HVAC');

-- AlterTable
ALTER TABLE "Application" DROP COLUMN "program",
ADD COLUMN     "dateOfSale" TIMESTAMP(3),
ADD COLUMN     "financeItNumber" TEXT,
ADD COLUMN     "financeReference" TEXT,
ADD COLUMN     "financingNote" TEXT,
ADD COLUMN     "hdReference" TEXT,
ADD COLUMN     "homeDepotStoreId" TEXT,
ADD COLUMN     "installationDate" TIMESTAMP(3),
ADD COLUMN     "loanReference" TEXT,
ADD COLUMN     "programCategory" "ProgramCategory" NOT NULL,
ADD COLUMN     "programType" "ProgramType" NOT NULL;

-- CreateTable
CREATE TABLE "HomeDepotStore" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeDepotStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeDepotStore_dealerId_idx" ON "HomeDepotStore"("dealerId");

-- CreateIndex
CREATE INDEX "Application_homeDepotStoreId_idx" ON "Application"("homeDepotStoreId");

-- CreateIndex
CREATE INDEX "Application_loanReference_idx" ON "Application"("loanReference");

-- CreateIndex
CREATE INDEX "Application_financeReference_idx" ON "Application"("financeReference");

-- CreateIndex
CREATE INDEX "Application_hdReference_idx" ON "Application"("hdReference");

-- CreateIndex
CREATE INDEX "Application_financeItNumber_idx" ON "Application"("financeItNumber");

-- AddForeignKey
ALTER TABLE "HomeDepotStore" ADD CONSTRAINT "HomeDepotStore_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_homeDepotStoreId_fkey" FOREIGN KEY ("homeDepotStoreId") REFERENCES "HomeDepotStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
