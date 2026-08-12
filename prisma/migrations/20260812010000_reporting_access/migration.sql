-- Reporting access control.
--   User.canViewReports        : dealer-facing "My Reports" access (per-user).
--   Dealer.reportsEnabled      : dealer-facing "My Reports" access (per-dealer).
--     A dealer user sees their own office's reports when either flag is on.
--   User.canViewLeadershipReport : the company-wide weekly leadership snapshot
--     (all dealers / national). Super Admins have it implicitly; this grants it
--     to a specific internal user without making them a Super Admin.
ALTER TABLE "User" ADD COLUMN "canViewReports" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "canViewLeadershipReport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Dealer" ADD COLUMN "reportsEnabled" BOOLEAN NOT NULL DEFAULT false;
