-- Logged AI support Q&A for the review/promote ("learning") loop.
CREATE TABLE "AssistantQa" (
  "id"        TEXT NOT NULL,
  "dealerId"  TEXT,
  "area"      TEXT NOT NULL DEFAULT 'general',
  "question"  TEXT NOT NULL,
  "answer"    TEXT NOT NULL,
  "deferred"  BOOLEAN NOT NULL DEFAULT false,
  "promoted"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantQa_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssistantQa_createdAt_idx" ON "AssistantQa"("createdAt");
CREATE INDEX "AssistantQa_deferred_idx" ON "AssistantQa"("deferred");
