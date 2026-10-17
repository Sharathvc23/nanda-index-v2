/**
 * Operator moderation from the shell — the same effect as
 * POST /api/v1/admin/orgs/... without needing an operator login. Useful on
 * the droplet, e.g. to hide the mbox- test registrations:
 *
 *   npx tsx scripts/moderate.ts --prefix mbox- --set hidden
 *   npx tsx scripts/moderate.ts --org some-org --set takedown
 *   npx tsx scripts/moderate.ts --prefix mbox- --set hidden --dry-run
 *
 * Reads DATABASE_URL from the environment. Moderation states: none | hidden | takedown
 * (see db/migrations/017_moderation_and_listing.sql).
 */
import { parseArgs } from 'node:util';
import { closeSql, getSql } from '../src/db/client.js';
import { setModeration, setModerationByPrefix } from '../src/db/queries/organizations.js';
import { MODERATION_STATES, type Moderation } from '../src/types/api/index-record.js';

/** Same floor as the bulk API route: a slip must not moderate the whole index. */
const MIN_PREFIX_LENGTH = 3;

const USAGE = 'usage: npx tsx scripts/moderate.ts (--prefix <org_id prefix> | --org <org_id>) --set <none|hidden|takedown> [--dry-run]';

function fail(message: string): never {
  console.error(`${message}\n${USAGE}`);
  process.exit(1);
}

function isModeration(value: string | undefined): value is Moderation {
  return (MODERATION_STATES as readonly string[]).includes(value ?? '');
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      prefix: { type: 'string' },
      org: { type: 'string' },
      set: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  const { prefix, org } = values;
  if (!isModeration(values.set)) fail(`--set must be one of ${MODERATION_STATES.join(', ')}`);
  if ((prefix === undefined) === (org === undefined)) fail('pass exactly one of --prefix or --org');
  if (prefix !== undefined && prefix.length < MIN_PREFIX_LENGTH) {
    fail(`--prefix must be at least ${MIN_PREFIX_LENGTH} characters`);
  }
  const moderation = values.set;

  if (values['dry-run']) {
    const sql = getSql();
    const rows = prefix !== undefined
      ? await sql<{ orgId: string; moderation: string }[]>`
          SELECT org_id, moderation FROM organizations WHERE starts_with(org_id, ${prefix}) ORDER BY org_id`
      : await sql<{ orgId: string; moderation: string }[]>`
          SELECT org_id, moderation FROM organizations WHERE org_id = ${org!}`;
    for (const r of rows) console.log(`${r.orgId}\t${r.moderation} -> ${moderation}`);
    console.log(`dry run: ${rows.length} org(s) would be set to ${moderation}`);
    return;
  }

  if (prefix !== undefined) {
    const orgIds = await setModerationByPrefix(prefix, moderation);
    for (const id of orgIds) console.log(id);
    console.log(`set moderation=${moderation} on ${orgIds.length} org(s) with prefix "${prefix}"`);
    return;
  }

  const updated = await setModeration(org!, moderation);
  if (!updated) fail(`org "${org}" not found`);
  console.log(`set moderation=${moderation} on ${updated.orgId}`);
}

main()
  .catch((err: unknown) => {
    console.error('moderation failed:', err);
    process.exitCode = 1;
  })
  .finally(() => closeSql());
