-- Dealer requested a human agent: pause the AI assistant + flag for the team.
ALTER TABLE "Conversation" ADD COLUMN "awaitingHuman" BOOLEAN NOT NULL DEFAULT false;
