-- Per-user grant for the full detailed customer search (internal staff only).
ALTER TABLE "User" ADD COLUMN "canSearchCustomers" BOOLEAN NOT NULL DEFAULT false;
