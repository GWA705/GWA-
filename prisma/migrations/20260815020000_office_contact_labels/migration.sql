-- Editable section titles for the two fixed office contacts. Null falls back to
-- "Billing" / "Customer support" in the UI.
ALTER TABLE "DealerProfile" ADD COLUMN IF NOT EXISTS "billingLabel" TEXT;
ALTER TABLE "DealerProfile" ADD COLUMN IF NOT EXISTS "supportLabel" TEXT;
