-- Per-office Entuitive "New User" defaults (auto-fill each person's setup sheet).
ALTER TABLE "Dealer" ADD COLUMN "idTagOfficeProfile" JSONB;

-- ID-tag person detail: split name, headshot + finished card files, and the
-- data read off the issued Entuitive card.
ALTER TABLE "HomeDepotIdTag" ADD COLUMN "personFirst" TEXT;
ALTER TABLE "HomeDepotIdTag" ADD COLUMN "personLast" TEXT;
ALTER TABLE "HomeDepotIdTag" ADD COLUMN "headshotKey" TEXT;
ALTER TABLE "HomeDepotIdTag" ADD COLUMN "cardFileKey" TEXT;
ALTER TABLE "HomeDepotIdTag" ADD COLUMN "validUntil" TIMESTAMP(3);
ALTER TABLE "HomeDepotIdTag" ADD COLUMN "badgeNumber" TEXT;
ALTER TABLE "HomeDepotIdTag" ADD COLUMN "entuitiveStatus" TEXT;
