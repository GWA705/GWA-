-- Morning catch-up digest: remember when each reviewer last marked themselves
-- caught up, so the digest can summarise everything since. Additive, nullable —
-- no backfill, no behaviour change for existing rows.
ALTER TABLE "User" ADD COLUMN "catchUpSeenAt" TIMESTAMP(3);
