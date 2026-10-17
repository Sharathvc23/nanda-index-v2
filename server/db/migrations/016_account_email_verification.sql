-- Migration 016: account email verification, targeted-lockout fix, session revocation
--
--   1. Account email verification. An account must prove it owns its email
--      before it can create or manage organizations. Only a SHA-256 *hash* of
--      the emailed token is stored (same reasoning as password_reset_tokens).
--      email_verify_sent_at backs the resend cooldown.
--   2. login_failures replaces the per-user failed_login_attempts/locked_until
--      counters from 009. Those locked an account for everyone after 5 bad
--      passwords from anyone, so an attacker could keep any user locked out.
--      Tracking per (email, client IP) means an attacker only locks their own
--      IP. Keyed by the submitted email (not user_id) so unknown emails lock
--      exactly like real ones and a 429 does not reveal that an account exists.
--      The old 009 columns are left in place (unused) so a rollback of the app
--      code does not need a schema rollback.
--   3. token_version is embedded in every session JWT; bumping it (on password
--      reset) invalidates all sessions issued before.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified                BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verify_token            VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_verify_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verify_sent_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_version                 INT         NOT NULL DEFAULT 0;

-- Backfill: Google and GitHub verify email ownership themselves. The GitHub
-- callback falls back to a synthetic "<login>@github.noreply" address when no
-- email is available — that one is not a real verified mailbox. Email/password
-- accounts stay unverified and are asked to verify on their next sign-in.
UPDATE users
SET email_verified = TRUE
WHERE provider IN ('google', 'github')
  AND email NOT LIKE '%@github.noreply';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_verify_token
  ON users(email_verify_token)
  WHERE email_verify_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS login_failures (
  email          VARCHAR(255) NOT NULL,
  ip_address     VARCHAR(64)  NOT NULL,
  failed_count   INT          NOT NULL DEFAULT 0,
  last_failed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  locked_until   TIMESTAMPTZ,
  PRIMARY KEY (email, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_login_failures_last_failed_at ON login_failures(last_failed_at);
