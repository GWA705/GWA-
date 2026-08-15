-- SOAP variant (NV / PS / OTHER), shown as "Yes - NV/PS/Other". Legacy rows keep
-- the plain soapIncluded Yes/No and leave this null.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "soapType" TEXT;
