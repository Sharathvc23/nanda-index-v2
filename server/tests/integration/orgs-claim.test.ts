/**
 * Re-proving a domain to recover an org that has no administrator.
 *
 * `org_memberships.user_id` is `REFERENCES users(id) ON DELETE CASCADE` and
 * `insertMembership` runs in exactly one place — org creation. So removing a
 * user row takes its memberships with it while the `organizations` row
 * survives, leaving an org nobody can administer. Everything that could fix it
 * is gated on `requireOrgRole('admin')`: the record cannot be updated,
 * suspended, deleted to free the slug, or re-verified. Re-registering is
 * refused as well — `findSlugConflict` releases only an `isAbandonedClaim`
 * (false for anything `everProven`) and `findConflict` keeps the proven domain
 * reserved. The entry stays `active` and keeps being served throughout.
 *
 * The org never lost the ability to prove ownership, only the permission to
 * attempt it. These tests pin the properties that make re-proving safe:
 *
 *   - it restores a real write (403 → 200 on PUT /api/v1/orgs/:org_id)
 *   - it refuses an org that still HAS an admin: recovery, not takeover
 *   - it is not an oracle for whether an org has an admin — the challenge is
 *     issued identically either way, and the no-admin verdict is only reachable
 *     AFTER the DNS proof succeeds
 *   - DNS control is genuinely required
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';

// vi.hoisted lets the (hoisted) vi.mock factory reference the spy safely.
const { resolveTxtMock } = vi.hoisted(() => ({ resolveTxtMock: vi.fn() }));
// Every resolver verification asks — the host's own and each public one
// (defaultTxtResolver fans out to 1.1.1.1 / 8.8.8.8 / 9.9.9.9 via Resolver) —
// answers from the same spy, so a test states one DNS truth and all of them
// see it. Omitting `Resolver` makes the verifier throw rather than resolve.
vi.mock('node:dns/promises', () => ({
  resolveTxt: resolveTxtMock,
  Resolver: class {
    setServers(): void {}
    resolveTxt(name: string) { return resolveTxtMock(name); }
  },
}));

const { buildServer } = await import('../../src/server.js');
const { getSql } = await import('../../src/db/client.js');
const { upsertUser } = await import('../../src/db/queries/users.js');

const CLAIMANT_EMAIL = 'claim-claimant@example.com';
const SITTING_ADMIN_EMAIL = 'claim-sitting-admin@example.com';

async function seedProvenOrg(orgId: string, opts: { domain?: string | null } = {}): Promise<void> {
  const sql = getSql();
  const domain = opts.domain === null ? null : (opts.domain ?? `${orgId}.example.com`);
  await sql`
    INSERT INTO organizations
      (org_id, display_name, domain, contact_email, registry_url, verify_token,
       email_verified, domain_verified, ever_proven, status, identifier, media_type, description, tags)
    VALUES
      (${orgId}, ${`Claimable ${orgId}`}, ${domain}, ${`admin@${domain ?? 'example.com'}`},
       ${`https://${domain ?? 'example.com'}/registry`}, ${randomBytes(16).toString('hex')},
       true, ${domain !== null}, true, 'active',
       ${domain ? `urn:air:${domain}:catalog:root` : `urn:air:host39.org:personal:${orgId}@example.com`},
       'application/ai-catalog+json', 'claimable org fixture', ${sql.array(['claimfixture'])})
  `;
}

describe('Claiming an org by re-proving its domain', () => {
  let fastify: FastifyInstance;
  let claimantToken: string;
  let claimantId: string;
  let sittingAdminId: string;

  beforeAll(async () => {
    const built = await buildServer({ logger: false });
    fastify = built.fastify;
    await fastify.ready();

    const claimant = await upsertUser({
      email: CLAIMANT_EMAIL, displayName: 'Claimant', avatarUrl: null,
      provider: 'github', providerId: 'claim-claimant-pid',
    });
    claimantId = claimant.id;
    claimantToken = fastify.jwt.sign({ userId: claimant.id, email: claimant.email, displayName: null });

    const sitting = await upsertUser({
      email: SITTING_ADMIN_EMAIL, displayName: 'Sitting', avatarUrl: null,
      provider: 'github', providerId: 'claim-sitting-pid',
    });
    sittingAdminId = sitting.id;
  });

  afterAll(async () => {
    await fastify.close();
    const { closeSql } = await import('../../src/db/client.js');
    await closeSql();
  });

  beforeEach(async () => {
    resolveTxtMock.mockReset();
    const sql = getSql();
    await sql`DELETE FROM organizations WHERE org_id LIKE 'claim-%'`;
  });

  /** Walks phase 1 and publishes the returned record into the DNS mock. */
  async function issueAndPublish(orgId: string): Promise<void> {
    const phase1 = await fastify.inject({
      method: 'POST', url: `/api/v1/orgs/${orgId}/claim`,
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    expect(phase1.statusCode).toBe(202);
    expect(phase1.json().status).toBe('challenge_issued');
    resolveTxtMock.mockResolvedValue([[phase1.json().record_value]]);
  }

  // ── the recovery ──────────────────────────────────────────────────────────

  it('restores the ability to write to an org that had no admin', async () => {
    await seedProvenOrg('claim-recoverable');

    // Before: published, and unwritable by anyone.
    const before = await fastify.inject({
      method: 'PUT', url: '/api/v1/orgs/claim-recoverable',
      headers: { authorization: `Bearer ${claimantToken}` },
      payload: { tags: ['recovered'] },
    });
    expect(before.statusCode).toBe(403);
    expect(before.json().detail).toContain('not a member');

    await issueAndPublish('claim-recoverable');

    const claim = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-recoverable/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    expect(claim.statusCode).toBe(201);
    expect(claim.json().org_id).toBe('claim-recoverable');

    // After: the same request by the same account now succeeds.
    const after = await fastify.inject({
      method: 'PUT', url: '/api/v1/orgs/claim-recoverable',
      headers: { authorization: `Bearer ${claimantToken}` },
      payload: { tags: ['recovered'] },
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().tags).toEqual(['recovered']);

    const sql = getSql();
    const rows = await sql<{ role: string }[]>`
      SELECT role FROM org_memberships WHERE org_id = 'claim-recoverable' AND user_id = ${claimantId}
    `;
    expect(rows[0]!.role).toBe('admin');
  });

  it('the orphaned state is reachable by deleting the owning account', async () => {
    await seedProvenOrg('claim-by-cascade');
    const sql = getSql();
    const doomed = await upsertUser({
      email: 'claim-doomed@example.com', displayName: null, avatarUrl: null,
      provider: 'github', providerId: 'claim-doomed-pid',
    });
    await sql`INSERT INTO org_memberships (user_id, org_id, role) VALUES (${doomed.id}, 'claim-by-cascade', 'admin')`;

    await sql`DELETE FROM users WHERE id = ${doomed.id}`;

    const left = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM org_memberships WHERE org_id = 'claim-by-cascade'
    `;
    expect(left[0]!.count).toBe('0');
    // The org survives the cascade and stays published — the asymmetry that
    // makes this silent.
    const org = await sql<{ status: string }[]>`
      SELECT status FROM organizations WHERE org_id = 'claim-by-cascade'
    `;
    expect(org[0]!.status).toBe('active');
  });

  // ── recovery, not takeover ────────────────────────────────────────────────

  it('refuses an org that still has an admin, even with the domain proven', async () => {
    await seedProvenOrg('claim-administered');
    const sql = getSql();
    await sql`INSERT INTO org_memberships (user_id, org_id, role) VALUES (${sittingAdminId}, 'claim-administered', 'admin')`;

    await issueAndPublish('claim-administered');

    const claim = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-administered/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    expect(claim.statusCode).toBe(403);
    expect(claim.json().detail).toContain('already has an administrator');

    // No membership was created for the claimant.
    const rows = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM org_memberships WHERE org_id = 'claim-administered' AND user_id = ${claimantId}
    `;
    expect(rows[0]!.count).toBe('0');
  });

  it('a member-but-not-admin org is still administered and not claimable', async () => {
    await seedProvenOrg('claim-member-only');
    const sql = getSql();
    await sql`INSERT INTO org_memberships (user_id, org_id, role) VALUES (${sittingAdminId}, 'claim-member-only', 'member')`;

    await issueAndPublish('claim-member-only');
    const claim = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-member-only/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    // No ADMIN exists, so this org genuinely cannot be administered: claimable.
    expect(claim.statusCode).toBe(201);
  });

  // ── not an oracle ─────────────────────────────────────────────────────────

  it('the challenge is issued identically whether or not the org has an admin', async () => {
    // If the no-admin check ran before the DNS proof, this endpoint would let
    // anyone probe the membership state of any org in the index.
    await seedProvenOrg('claim-oracle-none');
    await seedProvenOrg('claim-oracle-admin');
    const sql = getSql();
    await sql`INSERT INTO org_memberships (user_id, org_id, role) VALUES (${sittingAdminId}, 'claim-oracle-admin', 'admin')`;

    const withoutAdmin = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-oracle-none/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    const withAdmin = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-oracle-admin/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });

    expect(withAdmin.statusCode).toBe(withoutAdmin.statusCode);
    expect(withAdmin.statusCode).toBe(202);
    expect(Object.keys(withAdmin.json()).sort()).toEqual(Object.keys(withoutAdmin.json()).sort());
    expect(withAdmin.json().status).toBe(withoutAdmin.json().status);
  });

  // ── DNS control is required ───────────────────────────────────────────────

  it('without the TXT record published, no membership is granted', async () => {
    await seedProvenOrg('claim-no-dns');
    const phase1 = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-no-dns/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    expect(phase1.statusCode).toBe(202);

    resolveTxtMock.mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }));
    const claim = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-no-dns/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    expect(claim.statusCode).toBe(400);
    expect(claim.json().error).toBe('DOMAIN_NOT_VERIFIED');

    const sql = getSql();
    const rows = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM org_memberships WHERE org_id = 'claim-no-dns'
    `;
    expect(rows[0]!.count).toBe('0');
  });

  it('a wrong TXT value does not satisfy the challenge', async () => {
    await seedProvenOrg('claim-wrong-txt');
    const phase1 = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-wrong-txt/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    expect(phase1.statusCode).toBe(202);

    resolveTxtMock.mockResolvedValue([['nanda-verify=some-other-token'], ['v=spf1 ~all']]);
    const claim = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-wrong-txt/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    expect(claim.statusCode).toBe(400);
    expect(claim.json().error).toBe('DOMAIN_NOT_VERIFIED');
  });

  it('the TXT record is looked up at the challenge name for the org domain', async () => {
    await seedProvenOrg('claim-dns-name');
    await issueAndPublish('claim-dns-name');
    await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-dns-name/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    expect(resolveTxtMock).toHaveBeenCalledWith('_nanda-challenge.claim-dns-name.example.com');
  });

  // ── shape ─────────────────────────────────────────────────────────────────

  it('a domain-less personal org cannot be claimed by DNS', async () => {
    await seedProvenOrg('claim-personal', { domain: null });
    const res = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-personal/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('NO_DOMAIN');
    expect(resolveTxtMock).not.toHaveBeenCalled();
  });

  it('an unknown org is reported as a missing org, not a missing route', async () => {
    // A bare 404 assertion would pass against a build with no claim route at
    // all, so the body is asserted too: the handler names the org it could not
    // find, which a missing route cannot do.
    const res = await fastify.inject({
      method: 'POST', url: '/api/v1/orgs/claim-nope/claim',
      headers: { authorization: `Bearer ${claimantToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('NOT_FOUND');
    expect(res.json().detail).toContain('org "claim-nope"');
  });

  it('an unauthenticated claim is rejected', async () => {
    await seedProvenOrg('claim-anon');
    const res = await fastify.inject({ method: 'POST', url: '/api/v1/orgs/claim-anon/claim' });
    expect(res.statusCode).toBe(401);
    expect(resolveTxtMock).not.toHaveBeenCalled();
  });
});
