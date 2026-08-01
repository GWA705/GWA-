-- CreateTable
CREATE TABLE "DealerAlert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "dealerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertAck" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertAck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealerAlert_active_idx" ON "DealerAlert"("active");

-- CreateIndex
CREATE INDEX "AlertAck_alertId_idx" ON "AlertAck"("alertId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertAck_alertId_userId_key" ON "AlertAck"("alertId", "userId");

-- AddForeignKey
ALTER TABLE "DealerAlert" ADD CONSTRAINT "DealerAlert_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertAck" ADD CONSTRAINT "AlertAck_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "DealerAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertAck" ADD CONSTRAINT "AlertAck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
