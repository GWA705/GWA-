-- Archived closed-year sales-journal rows (imported via scripts/import-journals.ts).
CREATE TABLE "JournalRecord" (
  "id"             TEXT NOT NULL,
  "year"           INTEGER NOT NULL,
  "tab"            TEXT NOT NULL,
  "rowNum"         INTEGER NOT NULL,
  "dealerId"       TEXT,
  "location"       TEXT NOT NULL DEFAULT '',
  "customerName"   TEXT NOT NULL DEFAULT '',
  "firstName"      TEXT NOT NULL DEFAULT '',
  "lastName"       TEXT NOT NULL DEFAULT '',
  "phone"          TEXT NOT NULL DEFAULT '',
  "address"        TEXT NOT NULL DEFAULT '',
  "hdRef"          TEXT NOT NULL DEFAULT '',
  "hdStore"        TEXT NOT NULL DEFAULT '',
  "storeNumber"    TEXT,
  "product"        TEXT NOT NULL DEFAULT '',
  "result"         TEXT NOT NULL DEFAULT '',
  "financeBucket"  TEXT NOT NULL DEFAULT '',
  "sourceCategory" TEXT NOT NULL DEFAULT '',
  "saleDate"       TIMESTAMP(3),
  "datePaid"       TIMESTAMP(3),
  "gross"          DECIMAL(12,2),
  "net"            DECIMAL(12,2),
  "isHD"           BOOLEAN NOT NULL DEFAULT false,
  "isMisc"         BOOLEAN NOT NULL DEFAULT false,
  "link"           TEXT NOT NULL DEFAULT '',
  "importedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "JournalRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JournalRecord_year_tab_rowNum_key" ON "JournalRecord"("year", "tab", "rowNum");
CREATE INDEX "JournalRecord_dealerId_lastName_idx" ON "JournalRecord"("dealerId", "lastName");
CREATE INDEX "JournalRecord_dealerId_phone_idx" ON "JournalRecord"("dealerId", "phone");
CREATE INDEX "JournalRecord_year_idx" ON "JournalRecord"("year");
