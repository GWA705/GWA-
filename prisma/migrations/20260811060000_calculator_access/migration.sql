-- Access control for the dealer payout calculator: per-user and per-dealer.
-- A user can use it if either their own flag or their dealer's flag is on.
ALTER TABLE "User" ADD COLUMN "canUseCalculator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Dealer" ADD COLUMN "calculatorEnabled" BOOLEAN NOT NULL DEFAULT false;
