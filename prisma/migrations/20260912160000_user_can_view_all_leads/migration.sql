-- Leads-oversight grant: cross-office leads + lead reports (grantable to dealers)
ALTER TABLE "User" ADD COLUMN "canViewAllLeads" BOOLEAN NOT NULL DEFAULT false;
