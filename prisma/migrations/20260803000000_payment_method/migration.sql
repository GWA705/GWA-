-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('FINANCEIT', 'CASH', 'CHEQUE', 'CREDIT_CARD', 'HD_CREDIT_CARD');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "paymentMethod" "PaymentMethod";
