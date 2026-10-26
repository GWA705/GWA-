-- Portal-managed recipient directory for the weekly Home Depot store reports,
-- seeded from the GWA contacts sheet and editable in the admin UI.
CREATE TABLE IF NOT EXISTS "HdStoreContact" (
  "id"            TEXT PRIMARY KEY,
  "storeNumber"   TEXT NOT NULL,
  "storeName"     TEXT,
  "district"      TEXT,
  "storeContacts" TEXT,
  "ism"           TEXT,
  "distributor"   TEXT,
  "officeManager" TEXT,
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "HdStoreContact_storeNumber_key" ON "HdStoreContact" ("storeNumber");
CREATE INDEX IF NOT EXISTS "HdStoreContact_district_idx" ON "HdStoreContact" ("district");
