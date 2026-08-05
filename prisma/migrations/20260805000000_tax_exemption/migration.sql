-- First Nations tax exemption: flag + captured info on the deal.
ALTER TABLE "Application" ADD COLUMN "taxExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN "deliveredToReserve" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN "statusCardNumberEnc" TEXT;
ALTER TABLE "Application" ADD COLUMN "bandName" TEXT;
