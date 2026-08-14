-- Per-user grant for the admin Dealer Snapshot report (cross-dealer sold/paid/
-- pending). Super Admins have it implicitly; this lets a specific internal user
-- be given the report without full Super Admin.
ALTER TABLE "User" ADD COLUMN "canViewDealerSnapshot" BOOLEAN NOT NULL DEFAULT false;
