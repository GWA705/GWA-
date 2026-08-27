-- Per-user grant to fulfill water-test gift cards (staff Gift cards queue).
ALTER TABLE "User" ADD COLUMN "canManageGiftCards" BOOLEAN NOT NULL DEFAULT false;
