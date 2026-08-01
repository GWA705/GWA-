-- Per-finance-company rule: require a serial number for each product (e.g. UEI).
ALTER TABLE "FinanceCompany" ADD COLUMN IF NOT EXISTS "requiresSerialPerProduct" BOOLEAN NOT NULL DEFAULT false;
