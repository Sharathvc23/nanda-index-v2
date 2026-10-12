import { listActiveWithoutRepresentativeQueries, setRepresentativeQueries } from '../db/queries/organizations.js';
import type { OrgEnrichmentInput } from './llmEnrichment.js';

export interface BackfillOptions {
  /** Produces representative queries for one entry; an empty result counts as a failure. */
  readonly generate: (input: OrgEnrichmentInput) => Promise<string[]>;
  /** Report what would change without writing. */
  readonly dryRun?: boolean;
  /** Only consider entries whose org_id starts with this prefix. */
  readonly orgIdPrefix?: string;
}

export interface BackfillSummary {
  readonly checked: number;
  readonly updated: number;
  readonly failed: number;
  readonly failedOrgIds: readonly string[];
}

/**
 * Fills representative queries for active entries registered before write-time
 * enrichment was enabled (they have none, so search can't bridge phrasing gaps
 * for them). Entries are processed one at a time so a slow or failing LLM call
 * only affects that entry.
 */
export async function backfillRepresentativeQueries(opts: BackfillOptions): Promise<BackfillSummary> {
  const orgs = await listActiveWithoutRepresentativeQueries(opts.orgIdPrefix);
  const failedOrgIds: string[] = [];
  let updated = 0;

  for (const org of orgs) {
    const queries = await opts
      .generate({ displayName: org.displayName, description: org.description, tags: org.tags })
      .catch(() => []);
    if (queries.length === 0) {
      failedOrgIds.push(org.orgId);
      continue;
    }
    if (!opts.dryRun) {
      await setRepresentativeQueries(org.orgId, queries);
      updated += 1;
    }
  }

  return { checked: orgs.length, updated, failed: failedOrgIds.length, failedOrgIds };
}
