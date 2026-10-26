-- HD remittances carry non-deal deduction rows (lead fees, program fees) that
-- reduce the net payment but match no deal. Add a line status for them so they're
-- recorded and netted instead of silently dropped.
ALTER TYPE "RemittanceLineStatus" ADD VALUE IF NOT EXISTS 'DEDUCTION';
