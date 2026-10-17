-- 017: operator moderation for index entries.
--
--   none     — normal entry (default).
--   hidden   — left out of every listing and search (index list, keyword and
--              agentic search, ARD agents/explore) but still resolvable by its
--              exact identifier and readable at GET /api/v1/index/:org_id.
--              Used for test registrations and low-quality entries that should
--              not be advertised but whose callers should not break.
--   takedown — additionally not resolvable or publicly readable at all; the
--              owner cannot toggle it back via suspend/reactivate. Only an
--              operator can lift it.
--
-- Moderation is deliberately a separate axis from `status` (owner-controlled
-- lifecycle): an owner reactivating their entry must never undo an operator's
-- decision. No org ids are named here — operators apply moderation through
-- POST /api/v1/admin/orgs/... or server/scripts/moderate.ts.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS moderation VARCHAR(16) NOT NULL DEFAULT 'none';

ALTER TABLE organizations
  ADD CONSTRAINT organizations_moderation_values
    CHECK (moderation IN ('none', 'hidden', 'takedown'));
