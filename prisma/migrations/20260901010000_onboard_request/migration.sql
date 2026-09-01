-- Public new-dealer intake requests (from /request-access).
CREATE TABLE "OnboardRequest" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "note" TEXT,
    "people" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,

    CONSTRAINT "OnboardRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OnboardRequest_status_idx" ON "OnboardRequest"("status");
