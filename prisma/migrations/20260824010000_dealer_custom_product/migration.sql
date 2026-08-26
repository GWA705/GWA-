-- Per-dealer custom products, explicitly added by the dealer (replaces the
-- silent "auto-promote after >2 uses").
CREATE TABLE "DealerCustomProduct" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DealerCustomProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DealerCustomProduct_dealerId_name_key" ON "DealerCustomProduct"("dealerId", "name");
CREATE INDEX "DealerCustomProduct_dealerId_idx" ON "DealerCustomProduct"("dealerId");
ALTER TABLE "DealerCustomProduct" ADD CONSTRAINT "DealerCustomProduct_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: keep anything the old rule already surfaced (a dealer's "Other"
-- entry used on >2 of their deals, and not already an admin Product) so no
-- dealer's list shrinks when we switch to the explicit opt-in.
INSERT INTO "DealerCustomProduct" ("id", "dealerId", "name", "createdAt")
SELECT 'dcp_' || md5(x."dealerId" || '|' || x.name), x."dealerId", x.name, CURRENT_TIMESTAMP
FROM (SELECT a."dealerId", unnest(a."productsSold") AS name FROM "Application" a) x
WHERE x.name IS NOT NULL
  AND btrim(x.name) <> ''
  AND lower(btrim(x.name)) NOT IN (SELECT lower(btrim(p.name)) FROM "Product" p)
GROUP BY x."dealerId", x.name
HAVING count(*) > 2
ON CONFLICT ("dealerId", "name") DO NOTHING;
