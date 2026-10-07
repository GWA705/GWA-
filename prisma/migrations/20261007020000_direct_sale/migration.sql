-- Direct sale (Georgian Water & Air in-store walk-in, entered + funded by GWA
-- staff). Additive:
-- - EntryMethod.DIRECT: marks a deal entered via the Direct sale screen.
-- - User.canEnterDirectSale: per-user grant for the Direct sale screen (internal
--   staff have it implicitly; this opens it to a specific GWA office person
--   without opening it to dealers generally).
ALTER TYPE "EntryMethod" ADD VALUE IF NOT EXISTS 'DIRECT';
ALTER TABLE "User" ADD COLUMN "canEnterDirectSale" BOOLEAN NOT NULL DEFAULT false;
