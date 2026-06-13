-- Add token expiry tracking so verify tokens actually expire after 24 hours.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS verify_token_expires_at TIMESTAMPTZ;

-- Back-fill: any existing pending orgs get a window from their created_at.
UPDATE organizations
  SET verify_token_expires_at = created_at + INTERVAL '24 hours'
  WHERE verify_token IS NOT NULL AND verify_token_expires_at IS NULL;
