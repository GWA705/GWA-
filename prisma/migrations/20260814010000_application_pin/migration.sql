-- Per-user "pin to top" for a dealer's Applications list.
CREATE TABLE "ApplicationPin" (
  "userId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationPin_pkey" PRIMARY KEY ("userId","applicationId")
);
CREATE INDEX "ApplicationPin_userId_idx" ON "ApplicationPin"("userId");
