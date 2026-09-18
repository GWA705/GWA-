-- Per-office toggle: show the dealer's payout amount to every user at the
-- dealership (not just the owner/distributor). Defaults true so everyone sees it;
-- an office can turn it off to restrict payout dollars to the distributor.
ALTER TABLE "Dealer" ADD COLUMN "showPayoutsToAllUsers" BOOLEAN NOT NULL DEFAULT true;
