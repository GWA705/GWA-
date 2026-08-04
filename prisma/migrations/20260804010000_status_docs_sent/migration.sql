-- Add the "install paperwork sent, awaiting the signed package" status so the
-- deal (and the dealer's label) advances automatically when the reviewer sends
-- the install documents. Placed after APPROVED in the pipeline order.
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'DOCS_SENT' AFTER 'APPROVED';
