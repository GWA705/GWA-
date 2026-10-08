-- Blank the auto-generated note on journal-sourced payouts. The paid-sync used to
-- stamp "Auto-filled from the sales journal (Pay to dealer)" on each auto-created
-- payout; it now leaves the note blank, and this clears the ones already written
-- so the Notes column shows nothing for them. (The journal auto-fill is still
-- recorded in the audit log, so no history is lost.)
UPDATE "Payout" SET note = NULL WHERE note = 'Auto-filled from the sales journal (Pay to dealer)';
