import { describe, it, expect, afterEach, vi } from 'vitest';
import { sanitizeRemoteEntry, MAX_REMOTE_BODY_BYTES } from '../../src/services/remoteEntry.js';
import { fanOutAgentSearch } from '../../src/services/registryFanout.js';
import { allowAnyUrl } from '../../src/lib/outboundUrl.js';
import type { RankedOrganization } from '../../src/db/queries/organizations.js';

/**
 * Entries a registrant's registry returns are untrusted input. A malformed one
 * must be dropped rather than crash search for everyone, and an entry must not
 * claim an identifier anchored to someone else's domain or a non-https URL.
 */

const ORG_DOMAIN = 'acme.example.com';

const good = {
  identifier: 'flights', displayName: 'Flights', mediaType: 'application/a2a-agent-card+json',
  url: 'https://acme.example.com/agents/flights', tags: ['travel'],
};

describe('sanitizeRemoteEntry', () => {
  it('keeps a well-formed entry', () => {
    expect(sanitizeRemoteEntry(good, ORG_DOMAIN)).toMatchObject({ identifier: 'flights', url: good.url, tags: ['travel'] });
  });

  it.each([
    ['null', null],
    ['a string', 'flights'],
    ['no url', { ...good, url: undefined }],
    ['a non-string displayName', { ...good, displayName: 42 }],
    ['an empty identifier', { ...good, identifier: '' }],
    ['a javascript: url', { ...good, url: 'javascript:alert(1)' }],
    ['an http url', { ...good, url: 'http://acme.example.com/a' }],
    ['an unparseable url', { ...good, url: 'not a url' }],
  ])('drops an entry with %s', (_label, raw) => {
    expect(sanitizeRemoteEntry(raw, ORG_DOMAIN)).toBeNull();
  });

  it('drops an identifier anchored to another publisher', () => {
    const spoof = { ...good, identifier: 'urn:air:stripe.com:agent:payments' };
    expect(sanitizeRemoteEntry(spoof, ORG_DOMAIN)).toBeNull();
  });

  it('keeps an identifier anchored to the registry\'s own domain', () => {
    const own = { ...good, identifier: `urn:air:${ORG_DOMAIN}:agent:flights` };
    expect(sanitizeRemoteEntry(own, ORG_DOMAIN)?.identifier).toBe(`urn:air:${ORG_DOMAIN}:agent:flights`);
  });

  it('drops identifiers in other URN schemes, which carry no anchor we can check', () => {
    expect(sanitizeRemoteEntry({ ...good, identifier: 'urn:ai:domain:stripe.com' }, ORG_DOMAIN)).toBeNull();
  });

  it('keeps only string tags and caps their number and length', () => {
    const many = { ...good, tags: ['ok', 7, null, 'x'.repeat(500), ...Array.from({ length: 50 }, (_, i) => `t${i}`)] };
    const tags = sanitizeRemoteEntry(many, ORG_DOMAIN)!.tags!;
    expect(tags.every((t) => typeof t === 'string' && t.length <= 64)).toBe(true);
    expect(tags.length).toBeLessThanOrEqual(20);
    expect(tags[0]).toBe('ok');
  });

  it('treats a non-array tags field as no tags', () => {
    expect(sanitizeRemoteEntry({ ...good, tags: 'travel' }, ORG_DOMAIN)!.tags).toEqual([]);
  });

  it('truncates an oversized description', () => {
    const long = sanitizeRemoteEntry({ ...good, description: 'd'.repeat(10_000) }, ORG_DOMAIN)!;
    expect(long.description!.length).toBeLessThanOrEqual(2000);
  });
});

function enterpriseOrg(): RankedOrganization {
  return {
    id: 'id', orgId: 'acme', displayName: 'Acme', domain: ORG_DOMAIN,
    contactEmail: 'a@acme.example.com', registryUrl: 'https://acme.example.com/registry',
    emailVerified: true, verifyToken: null, verifyTokenExpiresAt: null, domainVerified: true,
    domainChallenge: null, domainChallengeExpiresAt: null, domainVerifiedAt: new Date(), everProven: true,
    ttlSeconds: 86400, status: 'active', createdAt: new Date(), updatedAt: new Date(),
    identifier: `urn:air:${ORG_DOMAIN}:catalog:root`, mediaType: 'application/ai-catalog+json',
    description: null, tags: [], publisher: null, extensions: { 'org.projectnanda': {} },
    entryData: null, version: null, trustManifest: null, representativeQueries: [], rank: 1,
  } as RankedOrganization;
}

describe('fanOutAgentSearch with hostile registries', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('drops malformed and spoofed entries but keeps the valid ones', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      specVersion: '1.0',
      entries: [null, { tags: 'x' }, { ...good, identifier: 'urn:air:stripe.com:agent:pay' }, good],
    }), { status: 200 })));

    const result = await fanOutAgentSearch([enterpriseOrg()], 'flights', { urlGuard: allowAnyUrl });

    expect(result.candidates.map((c) => c.entry.identifier)).toEqual(['flights']);
    expect(result.unreachable).toEqual([]);
  });

  it('treats an oversized response as unreachable instead of buffering it', async () => {
    const huge = JSON.stringify({ specVersion: '1.0', entries: [{ ...good, description: 'x'.repeat(MAX_REMOTE_BODY_BYTES) }] });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(huge, { status: 200 })));

    const result = await fanOutAgentSearch([enterpriseOrg()], 'flights', { urlGuard: allowAnyUrl });

    expect(result.unreachable).toEqual(['acme']);
    expect(result.candidates).toEqual([]);
  });
});
