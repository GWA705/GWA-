-- Billing flag: true when Georgian Water staff uploaded the mail-in card (leads
-- mailed to our office → billable to the owning office). False when the office
-- uploaded its own cards. Set at upload time from the scanner's role.
ALTER TABLE "ScannedLead" ADD COLUMN "uploadedByGwa" BOOLEAN NOT NULL DEFAULT false;
