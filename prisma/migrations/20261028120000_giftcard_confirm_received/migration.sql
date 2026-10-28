-- HD gift-card check on the confirmation call. Adds:
--   important    — urgent flag for cards requested/resent from a confirmation
--                  call, so the gift-card team sends them first;
--   receivedAt   — when a confirmer verified on the call that the customer
--                  actually received the card (we otherwise only track "sent");
--   receivedById — which staff user recorded that.
ALTER TABLE "GiftCardRequest" ADD COLUMN "important" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "receivedAt" TIMESTAMP(3),
ADD COLUMN "receivedById" TEXT;

CREATE INDEX "GiftCardRequest_important_idx" ON "GiftCardRequest"("important");

ALTER TABLE "GiftCardRequest" ADD CONSTRAINT "GiftCardRequest_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
