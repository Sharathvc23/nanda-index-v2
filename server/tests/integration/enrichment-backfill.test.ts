import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { getSql, closeSql } from '../../src/db/client.js';
import { backfillRepresentativeQueries } from '../../src/services/enrichmentBackfill.js';

async function seed(orgId: string, opts: { status?: string; queries?: string[] } = {}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO organizations
      (org_id, display_name, domain, contact_email, registry_url, verify_token, email_verified,
       status, identifier, media_type, description, tags, representative_queries)
    VALUES
      (${orgId}, ${`Name ${orgId}`}, ${`${orgId}.example.com`}, ${`admin@${orgId}.example.com`},
       ${`https://${orgId}.example.com/card.json`}, 'tok', true, ${opts.status ?? 'active'},
       ${`urn:air:${orgId}.example.com:agent:${orgId}`}, 'application/a2a-agent-card+json',
       ${`Description of ${orgId}`}, ${sql.array(['tag'])}, ${sql.array(opts.queries ?? [])})
  `;
}

async function queriesOf(orgId: string): Promise<string[]> {
  const [row] = await getSql()<{ representativeQueries: string[] }[]>`
    SELECT representative_queries FROM organizations WHERE org_id = ${orgId}`;
  return row?.representativeQueries ?? [];
}

describe('backfillRepresentativeQueries', () => {
  beforeEach(async () => {
    await getSql()`DELETE FROM organizations WHERE org_id LIKE 'bf-%'`;
  });

  afterAll(async () => {
    await getSql()`DELETE FROM organizations WHERE org_id LIKE 'bf-%'`;
    await closeSql();
  });

  it('fills representative queries for active entries that have none, from name/description/tags', async () => {
    await seed('bf-empty');
    const seen: unknown[] = [];

    const summary = await backfillRepresentativeQueries({
      generate: async (input) => { seen.push(input); return ['order a cake', 'bakery pickup']; },
      orgIdPrefix: 'bf-',
    });

    expect(await queriesOf('bf-empty')).toEqual(['order a cake', 'bakery pickup']);
    expect(seen).toContainEqual({ displayName: 'Name bf-empty', description: 'Description of bf-empty', tags: ['tag'] });
    expect(summary).toMatchObject({ checked: 1, updated: 1, failed: 0 });
  });

  it('leaves entries that already have queries, and inactive entries, untouched', async () => {
    await seed('bf-has', { queries: ['existing'] });
    await seed('bf-pending', { status: 'pending' });

    const summary = await backfillRepresentativeQueries({ generate: async () => ['new'], orgIdPrefix: 'bf-' });

    expect(await queriesOf('bf-has')).toEqual(['existing']);
    expect(await queriesOf('bf-pending')).toEqual([]);
    expect(summary.checked).toBe(0);
  });

  it('does not write anything in dry-run mode', async () => {
    await seed('bf-dry');

    const summary = await backfillRepresentativeQueries({ generate: async () => ['x'], dryRun: true, orgIdPrefix: 'bf-' });

    expect(await queriesOf('bf-dry')).toEqual([]);
    expect(summary).toMatchObject({ checked: 1, updated: 0 });
  });

  it('counts an entry whose generator throws as failed and keeps going', async () => {
    await seed('bf-throw');
    await seed('bf-fine');

    const summary = await backfillRepresentativeQueries({
      generate: async (input) => {
        if (input.displayName === 'Name bf-throw') throw new Error('LLM down');
        return ['ok'];
      },
      orgIdPrefix: 'bf-',
    });

    expect(await queriesOf('bf-fine')).toEqual(['ok']);
    expect(summary).toMatchObject({ checked: 2, updated: 1, failed: 1, failedOrgIds: ['bf-throw'] });
  });

  it('counts an entry the generator returns nothing for as failed and keeps going', async () => {
    await seed('bf-a');
    await seed('bf-b');

    const summary = await backfillRepresentativeQueries({
      generate: async (input) => (input.displayName === 'Name bf-a' ? [] : ['ok']),
      orgIdPrefix: 'bf-',
    });

    expect(await queriesOf('bf-a')).toEqual([]);
    expect(await queriesOf('bf-b')).toEqual(['ok']);
    expect(summary).toMatchObject({ checked: 2, updated: 1, failed: 1 });
  });
});
