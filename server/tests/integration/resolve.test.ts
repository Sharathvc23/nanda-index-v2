import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';
import { getSql } from '../../src/db/client.js';

interface SeedEntry {
  orgId: string;
  domain: string | null;
  identifier: string;
  mediaType: string;
  registryUrl: string;
  status?: 'active' | 'pending';
  domainVerified?: boolean;
}

async function seedEntry(entry: SeedEntry): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO organizations
      (org_id, display_name, domain, contact_email, registry_url, verify_token, email_verified,
       status, identifier, media_type, domain_verified, publisher)
    VALUES
      (${entry.orgId}, ${entry.orgId}, ${entry.domain}, ${`admin@${entry.domain ?? 'example.com'}`},
       ${entry.registryUrl}, 'tok', true, ${entry.status ?? 'active'}, ${entry.identifier}, ${entry.mediaType},
       ${entry.domainVerified ?? entry.domain !== null},
       ${sql.json({ identifier: entry.domain ?? 'host39.org', displayName: entry.orgId, identityType: 'dns' })})
  `;
}

const resolve = (fastify: FastifyInstance, locator: string) =>
  fastify.inject({ method: 'GET', url: `/api/v1/resolve?locator=${encodeURIComponent(locator)}` });

describe('GET /api/v1/resolve — urn:air: resolution', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    const built = await buildServer({ logger: false });
    fastify = built.fastify;
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
    const { closeSql } = await import('../../src/db/client.js');
    await closeSql();
  });

  beforeEach(async () => {
    const sql = getSql();
    await sql`DELETE FROM organizations WHERE org_id LIKE 'res-%'`;
  });

  it('resolves an exact agent-card identifier to its entry', async () => {
    await seedEntry({
      orgId: 'res-moon', domain: 'res-moon.example.com', identifier: 'urn:air:res-moon.example.com:agent:orders',
      mediaType: 'application/a2a-agent-card+json', registryUrl: 'https://agentcards.host39.org/res-moon/orders.json',
    });

    const res = await resolve(fastify, 'urn:air:res-moon.example.com:agent:orders');

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.locator).toBe('urn:air:res-moon.example.com:agent:orders');
    expect(body.match).toBe('exact');
    expect(body.identifier).toBe('orders');
    expect(body.entry.extensions['org.projectnanda'].orgId).toBe('res-moon');
    expect(body.entry.url).toBe('https://agentcards.host39.org/res-moon/orders.json');
  });

  it('returns the entry as a paper-shaped AI Catalog entry (§5.4), not the internal record', async () => {
    await seedEntry({
      orgId: 'res-shape', domain: 'res-shape.example.com', identifier: 'urn:air:res-shape.example.com:agent:orders',
      mediaType: 'application/a2a-agent-card+json', registryUrl: 'https://agentcards.host39.org/res-shape/orders.json',
    });

    const body = (await resolve(fastify, 'urn:air:res-shape.example.com:agent:orders')).json();

    expect(body).not.toHaveProperty('index_record');
    expect(body.entry).toMatchObject({
      identifier: 'urn:air:res-shape.example.com:agent:orders',
      displayName: expect.any(String),
      type: 'application/a2a-agent-card+json',
      url: 'https://agentcards.host39.org/res-shape/orders.json',
      publisher: { identifier: 'res-shape.example.com', identityType: 'dns' },
    });
    expect(body.entry).not.toHaveProperty('registry_url');
    expect(body.entry).not.toHaveProperty('media_type');
    expect(body.entry).not.toHaveProperty('display_name');
  });

  it('resolves a host39-anchored personal identifier', async () => {
    await seedEntry({
      orgId: 'res-john', domain: null, identifier: 'urn:air:host39.org:personal:res-john@hotmail.com',
      mediaType: 'application/a2a-agent-card+json', registryUrl: 'https://agentcards.host39.org/personal/res-john/card.json',
    });

    const res = await resolve(fastify, 'urn:air:host39.org:personal:res-john@hotmail.com');

    expect(res.statusCode).toBe(200);
    expect(res.json().match).toBe('exact');
    expect(res.json().entry.extensions['org.projectnanda'].orgId).toBe('res-john');
  });

  it('resolves a personal identifier whatever the case of the email', async () => {
    await seedEntry({
      orgId: 'res-mixed', domain: null, identifier: 'urn:air:host39.org:personal:res-mixed@hotmail.com',
      mediaType: 'application/a2a-agent-card+json', registryUrl: 'https://agentcards.host39.org/personal/res-mixed/card.json',
    });

    const res = await resolve(fastify, 'urn:air:host39.org:personal:Res-Mixed@HOTMAIL.com');

    expect(res.statusCode).toBe(200);
    expect(res.json().match).toBe('exact');
    expect(res.json().entry.extensions['org.projectnanda'].orgId).toBe('res-mixed');
  });

  it('normalises the publisher FQDN before matching', async () => {
    await seedEntry({
      orgId: 'res-sky', domain: 'res-sky.example.com', identifier: 'urn:air:res-sky.example.com:agent:refunds',
      mediaType: 'application/a2a-agent-card+json', registryUrl: 'https://api.res-sky.example.com/agents/refunds.json',
    });

    const res = await resolve(fastify, 'URN:AIR:Res-Sky.Example.COM:agent:refunds');

    expect(res.statusCode).toBe(200);
    expect(res.json().entry.extensions['org.projectnanda'].orgId).toBe('res-sky');
  });

  it('falls back to the publisher\'s catalog when the agent is listed inside it', async () => {
    await seedEntry({
      orgId: 'res-acme', domain: 'res-acme.example.com', identifier: 'urn:air:res-acme.example.com:catalog:root',
      mediaType: 'application/ai-catalog+json', registryUrl: 'https://registry.res-acme.example.com',
    });

    const res = await resolve(fastify, 'urn:air:res-acme.example.com:agent:time');

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.match).toBe('publisher');
    expect(body.identifier).toBe('time');
    expect(body.entry.identifier).toBe('urn:air:res-acme.example.com:catalog:root');
  });

  it('does not fall back to a different agent card under the same publisher', async () => {
    await seedEntry({
      orgId: 'res-bakery', domain: 'res-bakery.example.com', identifier: 'urn:air:res-bakery.example.com:agent:orders',
      mediaType: 'application/a2a-agent-card+json', registryUrl: 'https://agentcards.host39.org/res-bakery/orders.json',
    });

    const res = await resolve(fastify, 'urn:air:res-bakery.example.com:agent:catering');

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('returns 404 for an inactive entry', async () => {
    await seedEntry({
      orgId: 'res-pending', domain: 'res-pending.example.com', identifier: 'urn:air:res-pending.example.com:catalog:root',
      mediaType: 'application/ai-catalog+json', registryUrl: 'https://registry.res-pending.example.com', status: 'pending',
    });

    const res = await resolve(fastify, 'urn:air:res-pending.example.com:catalog:root');
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for an active entry whose domain is not verified', async () => {
    await seedEntry({
      orgId: 'res-unverified', domain: 'res-unverified.example.com',
      identifier: 'urn:air:res-unverified.example.com:catalog:root', mediaType: 'application/ai-catalog+json',
      registryUrl: 'https://registry.res-unverified.example.com', domainVerified: false,
    });

    expect((await resolve(fastify, 'urn:air:res-unverified.example.com:catalog:root')).statusCode).toBe(404);
    expect((await resolve(fastify, 'urn:air:res-unverified.example.com:agent:x')).statusCode).toBe(404);
  });

  it('returns 404 when the identifier is not in the index', async () => {
    const res = await resolve(fastify, 'urn:air:unknown.example.com:agent:x');
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('not_found');
  });

  it('returns 400 for the retired urn:ai: scheme', async () => {
    const res = await resolve(fastify, 'urn:ai:domain:example.com');
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_locator');
  });

  it('returns 400 when locator query param is missing', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/v1/resolve' });
    expect(res.statusCode).toBe(400);
  });
});
