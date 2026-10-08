-- HD Resolution contact card: customer + HD-rep contact details on the case.
-- All additive + nullable.
ALTER TABLE "ResolutionCase" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "ResolutionCase" ADD COLUMN "customerAddress" TEXT;
ALTER TABLE "ResolutionCase" ADD COLUMN "spouseName" TEXT;
ALTER TABLE "ResolutionCase" ADD COLUMN "spousePhone" TEXT;
ALTER TABLE "ResolutionCase" ADD COLUMN "hdRepName" TEXT;
ALTER TABLE "ResolutionCase" ADD COLUMN "hdRepPhone" TEXT;
ALTER TABLE "ResolutionCase" ADD COLUMN "hdRepEmail" TEXT;
ALTER TABLE "ResolutionCase" ADD COLUMN "extraContacts" JSONB;
