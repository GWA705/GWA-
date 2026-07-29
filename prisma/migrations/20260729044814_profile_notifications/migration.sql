-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationEmail" TEXT,
ADD COLUMN     "notifyNewDocuments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyNewNotes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyStatusUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT;
