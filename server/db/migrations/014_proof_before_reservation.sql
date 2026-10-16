-- 014: an unproven registration publishes nothing and reserves nothing.
--
--   * A personal entry is published only once its email is verified, and a
--     domain entry only once its domain is verified. Fix any personal row that
--     reached 'active' without email proof (the old reactivate path allowed it).
--   * Uniqueness of domain and identifier applies only among *proven* rows.
--     Anyone may hold an unproven claim on a domain or email; whoever proves it
--     first wins, and the application deletes the competing unproven claims.
--     Previously the first unproven claim blocked the real owner forever.

-- 0. Remember which orgs have ever proven ownership. A once-proven org is never
--    auto-released as an "abandoned claim", even if it later loses its proof
--    (e.g. its domain is changed and not yet re-verified).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ever_proven BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE organizations
   SET ever_proven = TRUE
 WHERE domain_verified OR domain_verified_at IS NOT NULL
    OR (domain IS NULL AND email_verified) OR status = 'active';

-- 1. Unpublish rows whose ownership was never proven (the old reactivate path
--    let personal rows through; domain rows are covered as a safety net).
UPDATE organizations
   SET status = 'pending', updated_at = NOW()
 WHERE status = 'active'
   AND ((domain IS NULL AND NOT email_verified) OR (domain IS NOT NULL AND NOT domain_verified));

-- 2. Domain: unique only among domain-verified rows (case-insensitive).
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_domain_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_verified_domain
    ON organizations (lower(domain))
 WHERE domain IS NOT NULL AND domain_verified;

-- 3. Identifier: unique only among rows whose ownership proof holds.
DROP INDEX IF EXISTS idx_organizations_identifier;
CREATE INDEX IF NOT EXISTS idx_organizations_identifier ON organizations (identifier);
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_proven_identifier
    ON organizations (identifier)
 WHERE (domain IS NOT NULL AND domain_verified) OR (domain IS NULL AND email_verified);
