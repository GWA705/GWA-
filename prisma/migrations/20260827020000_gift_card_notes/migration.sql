-- Optional customer cell + two-way note thread + unread flags for gift cards.
ALTER TABLE "GiftCardRequest" ADD COLUMN "customerPhone" TEXT;
ALTER TABLE "GiftCardRequest" ADD COLUMN "dealerUnread" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GiftCardRequest" ADD COLUMN "staffUnread" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "GiftCardNote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "fromDealer" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiftCardNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GiftCardNote_requestId_idx" ON "GiftCardNote"("requestId");
ALTER TABLE "GiftCardNote" ADD CONSTRAINT "GiftCardNote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "GiftCardRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GiftCardNote" ADD CONSTRAINT "GiftCardNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
