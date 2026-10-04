-- Admin-uploaded dashboard heroes (time-of-day slots + special occasions).
-- Additive: one new table; no existing table or behaviour changes. The file-based
-- public/hero-*.webp defaults keep working until a slot gets an uploaded override.
CREATE TABLE "DashboardHero" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "slotHour" INTEGER,
    "name" TEXT,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "scope" TEXT,
    "imageStorageKey" TEXT NOT NULL,
    "imageMime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardHero_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DashboardHero_kind_idx" ON "DashboardHero"("kind");
CREATE INDEX "DashboardHero_active_idx" ON "DashboardHero"("active");

ALTER TABLE "DashboardHero"
    ADD CONSTRAINT "DashboardHero_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
