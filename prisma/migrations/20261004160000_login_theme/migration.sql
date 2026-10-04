-- Admin-managed sign-in screen looks (full-bleed background + optional accent),
-- optionally scheduled for an occasion. Additive: one new table; nothing existing
-- changes. With no row (or none live), the login page keeps its built-in look
-- (normal, or the built-in Halloween skin during the spooky season).
CREATE TABLE "LoginTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "accentColor" TEXT,
    "imageStorageKey" TEXT NOT NULL,
    "imageMime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginTheme_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginTheme_active_idx" ON "LoginTheme"("active");

ALTER TABLE "LoginTheme"
    ADD CONSTRAINT "LoginTheme_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
