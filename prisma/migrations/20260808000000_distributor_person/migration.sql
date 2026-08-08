-- "Distributor" moves from a dealer-company type to a person-level flag: the
-- owner / main contact for a dealer. Mail can target distributors only.
-- Dealer.type is left in place (deprecated, defaults to DEALER) — no longer read.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "isDistributor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Mail" ADD COLUMN "distributorsOnly" BOOLEAN NOT NULL DEFAULT false;
