-- Reactivate a cancelled deal: a confirmed DealCancellation can be reversed when
-- an office turns a WITHDRAWN deal back into an active deal. Additive enum value.
ALTER TYPE "CancellationStatus" ADD VALUE IF NOT EXISTS 'REVERSED';
