-- Measured Anthropic API usage per service + model + day, so the System health
-- page can show real AI spend for the month (card reader + support assistant).
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiUsage_service_model_day_key" ON "AiUsage"("service", "model", "day");

CREATE INDEX "AiUsage_day_idx" ON "AiUsage"("day");
