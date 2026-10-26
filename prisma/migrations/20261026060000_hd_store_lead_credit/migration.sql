-- Associate credit for store-lead (701) sales on the weekly store report.
CREATE TABLE IF NOT EXISTS "HdStoreLeadCredit" (
  "id"            TEXT PRIMARY KEY,
  "hdRef"         TEXT NOT NULL,
  "associateName" TEXT,
  "source"        TEXT,
  "setById"       TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "HdStoreLeadCredit_hdRef_key" ON "HdStoreLeadCredit" ("hdRef");
