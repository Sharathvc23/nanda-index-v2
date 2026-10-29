-- Recovery proofs are scoped to an account and an immutable organization UUID.
-- Email codes are stored only as hashes; DNS tokens must be retrievable so a
-- caller can publish the same record again. Neither uses registration proofs.
CREATE TABLE org_recovery_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method          TEXT NOT NULL CHECK (method IN ('dns', 'email')),
  subject         TEXT NOT NULL,
  identifier      TEXT NOT NULL,
  token_hash      CHAR(64) NOT NULL,
  dns_token       CHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  UNIQUE (organization_id, user_id),
  CHECK ((method = 'dns' AND dns_token IS NOT NULL) OR (method = 'email' AND dns_token IS NULL))
);
CREATE INDEX org_recovery_expiry ON org_recovery_challenges(expires_at);

-- Changing an identity away and back must not revive a previously issued proof.
-- Keep this invariant even for operator SQL updates, not only the PUT route.
CREATE FUNCTION invalidate_org_recovery() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.domain IS DISTINCT FROM OLD.domain
     OR NEW.identifier IS DISTINCT FROM OLD.identifier
     OR NEW.contact_email IS DISTINCT FROM OLD.contact_email
     OR NEW.status = 'pending' OR NEW.moderation = 'takedown'
     OR (NEW.domain IS NOT NULL AND NOT NEW.domain_verified)
     OR (NEW.domain IS NULL AND NOT NEW.email_verified) THEN
    DELETE FROM org_recovery_challenges WHERE organization_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER invalidate_org_recovery
AFTER UPDATE OF domain, identifier, contact_email, status, moderation, domain_verified, email_verified
ON organizations FOR EACH ROW EXECUTE FUNCTION invalidate_org_recovery();
