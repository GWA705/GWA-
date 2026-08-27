-- Water-test reward gift-card requests (dealer submits → GWA sends via Guusto).
CREATE TYPE "GiftCardStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED');

CREATE TABLE "GiftCardRequest" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 25,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiftCardRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GiftCardRequest_dealerId_idx" ON "GiftCardRequest"("dealerId");
CREATE INDEX "GiftCardRequest_status_idx" ON "GiftCardRequest"("status");
ALTER TABLE "GiftCardRequest" ADD CONSTRAINT "GiftCardRequest_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GiftCardRequest" ADD CONSTRAINT "GiftCardRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GiftCardRequest" ADD CONSTRAINT "GiftCardRequest_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
