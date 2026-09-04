-- Live chat: unified conversations + messages, replacing the split between
-- per-deal notes and mail for dealer<->GWA chat.

CREATE TYPE "ConversationKind" AS ENUM ('DEAL', 'SUPPORT');

CREATE TABLE "Conversation" (
  "id"            TEXT NOT NULL,
  "dealerId"      TEXT NOT NULL,
  "kind"          "ConversationKind" NOT NULL,
  "applicationId" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Conversation_applicationId_key" ON "Conversation"("applicationId");
CREATE INDEX "Conversation_dealerId_idx" ON "Conversation"("dealerId");
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChatMessage" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "authorId"       TEXT NOT NULL,
  "fromStaff"      BOOLEAN NOT NULL,
  "body"           TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConversationRead" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "lastReadAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationRead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConversationRead_conversationId_userId_key" ON "ConversationRead"("conversationId", "userId");
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationRead" ADD CONSTRAINT "ConversationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: create one DEAL conversation per application that already has
-- dealer-facing (non-internal) notes, and copy those notes in as messages so
-- chat history carries over. Internal staff notes are left untouched.
INSERT INTO "Conversation" ("id", "dealerId", "kind", "applicationId", "createdAt", "lastMessageAt")
SELECT gen_random_uuid()::text, a."dealerId", 'DEAL'::"ConversationKind", a."id", now(),
       COALESCE((SELECT max(n."createdAt") FROM "Note" n WHERE n."applicationId" = a."id" AND n."internal" = false), now())
FROM "Application" a
WHERE EXISTS (SELECT 1 FROM "Note" n WHERE n."applicationId" = a."id" AND n."internal" = false);

INSERT INTO "ChatMessage" ("id", "conversationId", "authorId", "fromStaff", "body", "createdAt")
SELECT gen_random_uuid()::text, c."id", n."authorId", (u."role"::text IN ('ADMIN', 'REVIEWER')), n."body", n."createdAt"
FROM "Note" n
JOIN "Conversation" c ON c."applicationId" = n."applicationId"
JOIN "User" u ON u."id" = n."authorId"
WHERE n."internal" = false;
