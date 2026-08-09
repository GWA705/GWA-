-- Automated document pre-check results (assistive), stored per uploaded document.
ALTER TABLE "Document" ADD COLUMN "analysis" JSONB;
