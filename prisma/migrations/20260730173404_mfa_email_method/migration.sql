-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaEmailCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "mfaEmailCodeHash" TEXT,
ADD COLUMN     "mfaMethod" TEXT;
