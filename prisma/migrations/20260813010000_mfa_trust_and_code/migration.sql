-- Store the emailed 2FA code encrypted so a resend / re-login returns the SAME
-- code (fixes "expired code" when a new sender is greylisted and email is slow).
ALTER TABLE "User" ADD COLUMN "mfaEmailCodeEnc" TEXT;

-- Trusted-device support: a version stamp; bumping it revokes all remembered
-- devices for the user.
ALTER TABLE "User" ADD COLUMN "mfaTrustVersion" INTEGER NOT NULL DEFAULT 0;
