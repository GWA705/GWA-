-- Two-way mail replies (one conversation per dealer), gated per message.
-- AlterTable
ALTER TABLE "Mail" ADD COLUMN "allowReplies" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MailReply" (
    "id" TEXT NOT NULL,
    "mailId" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "fromStaff" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "staffReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailReply_mailId_dealerId_idx" ON "MailReply"("mailId", "dealerId");
CREATE INDEX "MailReply_mailId_staffReadAt_idx" ON "MailReply"("mailId", "staffReadAt");

-- AddForeignKey
ALTER TABLE "MailReply" ADD CONSTRAINT "MailReply_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "Mail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailReply" ADD CONSTRAINT "MailReply_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailReply" ADD CONSTRAINT "MailReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
