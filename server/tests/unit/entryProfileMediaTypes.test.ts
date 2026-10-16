import { describe, it, expect } from 'vitest';
import { buildEntryProfile, EntryProfileError } from '../../src/lib/entryProfile.js';
import { NANDA_MEDIA_TYPE } from '../../src/lib/mediaTypes.js';

/**
 * A personal entry has no domain to prove, only an email. It may publish one
 * agent (card, MCP server, skill) — never act as a catalog or registry the
 * index fans out to or refers searchers to, which would need DNS proof.
 */

const personal = {
  path: 'personal' as const, orgId: 'me', displayName: 'Me', domain: null,
  contactEmail: 'me@example.org',
};

describe('media types allowed for a personal entry', () => {
  it.each([NANDA_MEDIA_TYPE.A2A_CARD, NANDA_MEDIA_TYPE.MCP_CARD, NANDA_MEDIA_TYPE.AGENT_SKILL])(
    'allows %s', (mediaType) => {
      expect(buildEntryProfile({ ...personal, mediaType }).mediaType).toBe(mediaType);
    },
  );

  it.each([NANDA_MEDIA_TYPE.AI_CATALOG, NANDA_MEDIA_TYPE.AI_REGISTRY, NANDA_MEDIA_TYPE.ANS_REGISTRY])(
    'refuses %s', (mediaType) => {
      expect(() => buildEntryProfile({ ...personal, mediaType })).toThrow(EntryProfileError);
    },
  );

  it('still lets a domain registration be a catalog', () => {
    const profile = buildEntryProfile({
      path: 'registry', orgId: 'acme', displayName: 'Acme', domain: 'acme.example.com',
      contactEmail: 'a@acme.example.com', mediaType: NANDA_MEDIA_TYPE.AI_CATALOG,
    });
    expect(profile.mediaType).toBe(NANDA_MEDIA_TYPE.AI_CATALOG);
  });
});
