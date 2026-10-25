-- Richer booking activity streamed back from the booking app
-- (POST /api/intake/booking-event): appointments, installs and service visits.
-- Standalone log, matched to a deal/lead at display time by portalRef or
-- phoneLast4 (one id space spans two portal models, so no hard FK). Idempotent
-- on eventId. Opt-out events are applied to SmsOptOut, not stored here.
CREATE TABLE "BookingEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "portalRef" TEXT,
    "phoneLast4" TEXT,
    "type" TEXT NOT NULL,
    "stage" TEXT,
    "outcome" TEXT,
    "occurredAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingEvent_eventId_key" ON "BookingEvent"("eventId");
CREATE INDEX "BookingEvent_portalRef_idx" ON "BookingEvent"("portalRef");
CREATE INDEX "BookingEvent_phoneLast4_idx" ON "BookingEvent"("phoneLast4");
CREATE INDEX "BookingEvent_type_idx" ON "BookingEvent"("type");
