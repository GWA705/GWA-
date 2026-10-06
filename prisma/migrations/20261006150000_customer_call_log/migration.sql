-- Customer call log — a short, dated note each time a customer phones the
-- office, powering a "how many times have they called" snapshot. Additive: one
-- new table; nothing existing changes. customerPhone holds a normalized value
-- (last 10 digits) so calls for the same customer across different deals are
-- counted together. officeDealerId / forwardedToOfficeAt are populated when a
-- call is also forwarded to the owning office (Phase 2).
CREATE TABLE "CustomerCall" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL,
    "loggedById" TEXT NOT NULL,
    "officeDealerId" TEXT,
    "forwardedToOfficeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerCall_applicationId_idx" ON "CustomerCall"("applicationId");

CREATE INDEX "CustomerCall_customerPhone_idx" ON "CustomerCall"("customerPhone");

CREATE INDEX "CustomerCall_createdAt_idx" ON "CustomerCall"("createdAt");

ALTER TABLE "CustomerCall"
    ADD CONSTRAINT "CustomerCall_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerCall"
    ADD CONSTRAINT "CustomerCall_loggedById_fkey"
    FOREIGN KEY ("loggedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
