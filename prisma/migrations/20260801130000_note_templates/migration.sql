-- Admin-managed quick-note templates for reviewers.
CREATE TABLE "NoteTemplate" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NoteTemplate_active_sortOrder_idx" ON "NoteTemplate"("active", "sortOrder");
