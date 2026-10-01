-- Flag-an-issue to the dealer now sends a portal Mail that requires the office
-- to acknowledge they've read it. Store that mail's id on the deal so the deal
-- page can show a top banner with the acknowledgement state and a link to it.
-- Nullable; null = no issue flagged via the button on this deal.
ALTER TABLE "Application" ADD COLUMN "confirmationIssueMailId" TEXT;
