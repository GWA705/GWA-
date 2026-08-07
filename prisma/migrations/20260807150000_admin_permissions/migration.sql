-- Back-end access control for admins.
-- superAdmin: full access + the only role that can manage other admins' access.
-- adminSections: which admin sections a scoped (non-super) admin may reach.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "superAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "adminSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: existing administrators keep full access (become Super Admins) so no
-- one is locked out. A Super Admin can then scope any of them down from the
-- Admin access screen.
UPDATE "User" SET "superAdmin" = true WHERE "role" = 'ADMIN';
