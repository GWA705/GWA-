-- Expiry-reminder progress for ID tags: the smallest days-before threshold
-- (30/15/10/3) already sent. Reset when validUntil changes.
ALTER TABLE "HomeDepotIdTag" ADD COLUMN "expiryRemindStage" INTEGER;
