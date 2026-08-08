-- Human label for what an uploaded document is (Bill of Sale / Application info /
-- free text), shown in place of the raw file name.
ALTER TABLE "Document" ADD COLUMN "label" TEXT;
