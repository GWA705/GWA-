-- Dealer-submitted requests to create new portal logins, and an admin approval
-- queue. Non-destructive: two new tables + two enums.

CREATE TYPE "UserRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'CLOSED');
CREATE TYPE "UserRequestItemStatus" AS ENUM ('PENDING', 'CREATED', 'REJECTED');

CREATE TABLE "UserRequest" (
  "id"            TEXT NOT NULL,
  "dealerId"      TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "note"          TEXT,
  "status"        "UserRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById"  TEXT,
  "reviewedAt"    TIMESTAMP(3),
  CONSTRAINT "UserRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRequestItem" (
  "id"            TEXT NOT NULL,
  "requestId"     TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "phone"         TEXT,
  "jobTitle"      TEXT,
  "isMainContact" BOOLEAN NOT NULL DEFAULT false,
  "status"        "UserRequestItemStatus" NOT NULL DEFAULT 'PENDING',
  "createdUserId" TEXT,
  "decidedById"   TEXT,
  "decidedAt"     TIMESTAMP(3),
  "rejectReason"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserRequest_dealerId_idx" ON "UserRequest"("dealerId");
CREATE INDEX "UserRequest_status_idx" ON "UserRequest"("status");
CREATE INDEX "UserRequestItem_requestId_idx" ON "UserRequestItem"("requestId");
CREATE INDEX "UserRequestItem_status_idx" ON "UserRequestItem"("status");

ALTER TABLE "UserRequest"
  ADD CONSTRAINT "UserRequest_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "UserRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "UserRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserRequestItem"
  ADD CONSTRAINT "UserRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "UserRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
