-- Resolution case attachments (Phase 3b) — documents & resource links attached
-- directly to an HD resolution case. Additive: one new table. A 'file' is an
-- uploaded, encrypted-at-rest file served through an access-controlled route; a
-- 'link' is a URL (e.g. a resource-library manual).
CREATE TABLE "ResolutionAttachment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageKey" TEXT,
    "url" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolutionAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResolutionAttachment_caseId_idx" ON "ResolutionAttachment"("caseId");

ALTER TABLE "ResolutionAttachment"
    ADD CONSTRAINT "ResolutionAttachment_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "ResolutionCase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResolutionAttachment"
    ADD CONSTRAINT "ResolutionAttachment_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
