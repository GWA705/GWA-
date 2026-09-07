-- After-hours auto-reply: automated chat messages have no human author (authorId
-- becomes nullable) and are flagged with `auto` so the UI renders them as a
-- system note rather than a person's reply.
ALTER TABLE "ChatMessage" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "ChatMessage" ADD COLUMN "auto" BOOLEAN NOT NULL DEFAULT false;
