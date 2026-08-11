-- Office profiles (one per dealer) powering the staff directory, and
-- admin-managed support contacts shown on the dealer Contact/Support page.
-- Non-destructive: two new tables.

CREATE TABLE "DealerProfile" (
  "id"                 TEXT NOT NULL,
  "dealerId"           TEXT NOT NULL,
  "businessName"       TEXT,
  "address"            TEXT,
  "shippingAddress"    TEXT,
  "phone"              TEXT,
  "altPhone"           TEXT,
  "billingContactName" TEXT,
  "billingPhone"       TEXT,
  "billingEmail"       TEXT,
  "supportContactName" TEXT,
  "supportPhone"       TEXT,
  "supportEmail"       TEXT,
  "officeHours"        TEXT,
  "website"            TEXT,
  "updatedById"        TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DealerProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DealerProfile_dealerId_key" ON "DealerProfile"("dealerId");
ALTER TABLE "DealerProfile"
  ADD CONSTRAINT "DealerProfile_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupportContact" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "title"     TEXT,
  "phone"     TEXT,
  "altPhone"  TEXT,
  "email"     TEXT,
  "hours"     TEXT,
  "website"   TEXT,
  "notes"     TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportContact_pkey" PRIMARY KEY ("id")
);
