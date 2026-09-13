-- Voice of the Customer (VOC) survey imports from Home Depot.
CREATE TABLE "VocEntry" (
    "id" TEXT NOT NULL,
    "leadRef" TEXT NOT NULL,
    "storeName" TEXT,
    "storeNumber" TEXT,
    "district" TEXT,
    "submissionDate" TIMESTAMP(3),
    "reviewText" TEXT,
    "overallRating" INTEGER,
    "ivoc" INTEGER,
    "ltsa" INTEGER,
    "knowledgeable" INTEGER,
    "timely" INTEGER,
    "workmanship" INTEGER,
    "communication" INTEGER,
    "installerCare" INTEGER,
    "installerFriendliness" INTEGER,
    "importedById" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VocEntry_leadRef_key" ON "VocEntry"("leadRef");
CREATE INDEX "VocEntry_storeNumber_idx" ON "VocEntry"("storeNumber");
CREATE INDEX "VocEntry_submissionDate_idx" ON "VocEntry"("submissionDate");
