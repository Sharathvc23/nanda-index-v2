import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { getSql } from '../../src/db/client.js';

/**
 * Keyword search must find entries by what they describe, not only by name:
 * "fitness", "menu" or "pickup" found nothing even when an entry's tags or
 * description said exactly that (agentic search found them).
 */

async function seed(orgId: string, displayName: string, description: string | null, tags: string[]): Promise<void> {
  const sql = getSql();
  const domain = `${orgId}.example.com`;
  await sql`
    INSERT INTO organizations
      (org_id, display_name, domain, contact_email, registry_url, verify_token, email_verified, status,
       identifier, description, tags)
    VALUES
      (${orgId}, ${displayName}, ${domain}, ${`a@${domain}`}, ${`https://${domain}/r`},
       ${randomBytes(16).toString('hex')}, true, 'active', ${`urn:air:${domain}:catalog:root`},
       ${description}, ${sql.array(tags)})
    ON CONFLICT (org_id) DO NOTHING
  `;
}

describe('GET /api/v1/search — tags and descriptions', () => {
  let fastify: FastifyInstance;
  const search = async (q: string) => {
    const res = await fastify.inject({ method: 'GET', url: `/api/v1/search?q=${encodeURIComponent(q)}` });
    return (res.json().results as { org_id: string }[]).map((r) => r.org_id);
  };

  beforeAll(async () => {
    fastify = (await buildServer({ logger: false })).fastify;
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
    const { closeSql } = await import('../../src/db/client.js');
    await closeSql();
  });

  beforeEach(async () => {
    await getSql()`DELETE FROM organizations WHERE org_id LIKE 'sc-%'`;
    await seed('sc-gym', 'Iron Works', 'Book classes and manage memberships', ['fitness', 'classes']);
    await seed('sc-bistro', 'Le Petit', 'Order from our menu for pickup or delivery', ['restaurant']);
    await seed('sc-other', 'Unrelated Co', 'Nothing to see', ['misc']);
  });

  it('finds an entry by a tag that is not in its name', async () => {
    expect(await search('fitness')).toContain('sc-gym');
  });

  it('finds an entry by words in its description', async () => {
    const hits = await search('menu');
    expect(hits).toContain('sc-bistro');
    expect(await search('pickup')).toContain('sc-bistro');
    expect(hits).not.toContain('sc-other');
  });

  it('still finds an entry by name', async () => {
    expect(await search('iron works')).toContain('sc-gym');
  });

  it('ranks an exact org_id match first', async () => {
    await seed('sc-menu', 'Menu Org', null, []);
    expect((await search('sc-menu'))[0]).toBe('sc-menu');
  });

  it('treats % and _ as literal characters, not wildcards', async () => {
    expect(await search('%%')).not.toContain('sc-other');
    expect(await search('s_-')).not.toContain('sc-gym');
  });
});
