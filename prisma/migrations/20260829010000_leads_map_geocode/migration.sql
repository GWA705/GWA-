-- Leads map: store coordinates + geocode cache.

-- Map location for Home Depot stores (geocoded once, nullable until placed).
ALTER TABLE "HomeDepotStore" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "HomeDepotStore" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "HomeDepotStore" ADD COLUMN "geocodedAt" TIMESTAMP(3);

-- Cache of geocoded addresses so a lead location is resolved once, not per load.
CREATE TABLE "GeocodeCache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "label" TEXT,
    "source" TEXT NOT NULL DEFAULT 'google',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GeocodeCache_key_key" ON "GeocodeCache"("key");
