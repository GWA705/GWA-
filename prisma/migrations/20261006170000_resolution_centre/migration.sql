-- HD Resolution Centre — a queue for Home Depot resolution-centre problems.
-- Additive: one new enum + two new tables; nothing existing changes. A case
-- links to a customer (and the deal when there is one) and the owning office,
-- moves through a small status flow, and carries a notes/activity thread.

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_OFFICE', 'ESCALATED_HD', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "ResolutionCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ResolutionStatus" NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "applicationId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL DEFAULT '',
    "officeDealerId" TEXT,
    "hdReference" TEXT,
    "openedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolutionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionCaseNote" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "statusFrom" "ResolutionStatus",
    "statusTo" "ResolutionStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolutionCaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResolutionCase_caseNumber_key" ON "ResolutionCase"("caseNumber");
CREATE INDEX "ResolutionCase_status_idx" ON "ResolutionCase"("status");
CREATE INDEX "ResolutionCase_applicationId_idx" ON "ResolutionCase"("applicationId");
CREATE INDEX "ResolutionCase_customerPhone_idx" ON "ResolutionCase"("customerPhone");
CREATE INDEX "ResolutionCase_createdAt_idx" ON "ResolutionCase"("createdAt");
CREATE INDEX "ResolutionCaseNote_caseId_idx" ON "ResolutionCaseNote"("caseId");

-- AddForeignKey
ALTER TABLE "ResolutionCase" ADD CONSTRAINT "ResolutionCase_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResolutionCase" ADD CONSTRAINT "ResolutionCase_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResolutionCase" ADD CONSTRAINT "ResolutionCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResolutionCaseNote" ADD CONSTRAINT "ResolutionCaseNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ResolutionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResolutionCaseNote" ADD CONSTRAINT "ResolutionCaseNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
