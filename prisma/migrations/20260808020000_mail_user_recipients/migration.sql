-- Address mail to specific users (in addition to whole-dealer recipients).
-- CreateTable
CREATE TABLE "MailUserRecipient" (
    "id" TEXT NOT NULL,
    "mailId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "MailUserRecipient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MailUserRecipient_mailId_userId_key" ON "MailUserRecipient"("mailId", "userId");
CREATE INDEX "MailUserRecipient_userId_idx" ON "MailUserRecipient"("userId");
ALTER TABLE "MailUserRecipient" ADD CONSTRAINT "MailUserRecipient_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailUserRecipient" ADD CONSTRAINT "MailUserRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
