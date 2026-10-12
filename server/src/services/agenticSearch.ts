import { listCatalogsToProbe, rankOrganizationsForQuery, type RankedOrganization } from '../db/queries/organizations.js';
import { fanOutAgentSearch, type FanoutCandidate, type RemoteCatalogEntry } from './registryFanout.js';
import { toArdType } from '../lib/ardMapping.js';
import { buildAirUrn } from '../lib/airUrn.js';
import type { UrlGuard } from '../lib/outboundUrl.js';
import type { AgentCandidate, AgenticSearchResponse, FinderReferral } from '../types/api/agentic-search.js';

export interface AgenticSearchOptions {
  topOrgs?: number;
  perOrgLimit?: number;
  limit?: number;
  /** Unmatched live catalogs to look inside as well (see listCatalogsToProbe). */
  catalogProbeLimit?: number;
  /** SSRF check for registry fan-out (see registryFanout.ts). */
  urlGuard?: UrlGuard;
}

/** Query words shorter than this ("a", "to") are too common to show a probed result is on-topic. */
const MIN_CONTENT_TERM_LENGTH = 3;

/** Probed catalogs get less time than matched ones — they are a best-effort extra. */
const PROBE_TIMEOUT_MS = 1200;

function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\W+/).filter(Boolean);
}

/** Fraction of query terms present in `text` (case-insensitive substring match). */
function termOverlapScore(text: string, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  const lower = text.toLowerCase();
  const matched = queryTerms.filter((term) => lower.includes(term)).length;
  return matched / queryTerms.length;
}

/** The searchable text of a registry entry: name, description and tags. */
function entryText(entry: RemoteCatalogEntry): string {
  return `${entry.displayName} ${entry.description ?? ''} ${(entry.tags ?? []).join(' ')}`;
}

/**
 * Registries may return bare agent ids ("flights"). The entry was found via a
 * verified domain, so qualify it to the paper's urn:air:<domain>:agent:<id>
 * form; already-qualified URNs, and ids that can't form a valid URN, pass
 * through unchanged.
 */
function qualifyIdentifier(raw: string, org: RankedOrganization): string {
  if (raw.toLowerCase().startsWith('urn:') || !org.domain) return raw;
  try {
    return buildAirUrn(org.domain, ['agent'], raw);
  } catch {
    return raw;
  }
}

/** An ARD finder's search endpoint, by the ARD layout <base>/search (cf. /api/ard → /api/ard/search). */
function toFinderReferral(org: RankedOrganization): FinderReferral {
  return {
    identifier: org.identifier,
    displayName: org.displayName,
    searchUrl: `${org.registryUrl!.replace(/\/+$/, '')}/search`,
  };
}

function toAgentCandidate(
  { org, entry, basis }: FanoutCandidate,
  queryTerms: string[],
  maxOrgRank: number,
): AgentCandidate {
  const orgScore = maxOrgRank > 0 ? org.rank / maxOrgRank : 0;
  const overlapScore = termOverlapScore(entryText(entry), queryTerms);

  return {
    identifier: qualifyIdentifier(entry.identifier, org),
    displayName: entry.displayName,
    type: toArdType(entry.mediaType),
    url: entry.url,
    description: entry.description ?? null,
    tags: entry.tags ?? [],
    publisher: org.publisher ?? undefined,
    trustManifest: org.trustManifest ?? undefined,
    provenance: {
      orgId: org.orgId,
      registryUrl: org.registryUrl!,
      basis,
    },
    score: orgScore * 0.6 + overlapScore * 0.4,
  };
}

/**
 * Core agentic-search pipeline: rank candidate orgs locally (Postgres FTS),
 * add live catalogs that didn't match on their own text, fan out live to
 * expand each into agent-level candidates (branching by media_type — see
 * registryFanout.ts), then score and merge into one flat, ranked list. Backs
 * both /api/v1/agentic-search and /api/ard/search (ARD-compliant).
 */
export async function agenticSearch(
  query: string,
  opts: AgenticSearchOptions = {},
): Promise<AgenticSearchResponse> {
  const topOrgs = opts.topOrgs ?? 10;
  const perOrgLimit = opts.perOrgLimit ?? 10;
  const limit = opts.limit ?? 20;
  const catalogProbeLimit = opts.catalogProbeLimit ?? 10;
  const start = Date.now();

  const rankedOrgs = await rankOrganizationsForQuery(query, topOrgs);
  const maxOrgRank = rankedOrgs.reduce((max, o) => Math.max(max, o.rank), 0);
  const probedOrgs = await listCatalogsToProbe(rankedOrgs.map((o) => o.orgId), catalogProbeLimit);

  // Probes run alongside the ranked fan-out with a shorter timeout, so a slow
  // catalog the query never matched can't stretch the response. Their failures
  // aren't reported: the query never asked for them.
  const [ranked, probed] = await Promise.all([
    fanOutAgentSearch(rankedOrgs, query, { perOrgLimit, urlGuard: opts.urlGuard }),
    fanOutAgentSearch(probedOrgs, query, {
      perOrgLimit, urlGuard: opts.urlGuard, timeoutMs: PROBE_TIMEOUT_MS, concurrency: catalogProbeLimit,
    }),
  ]);

  const queryTerms = tokenize(query);
  const contentTerms = queryTerms.filter((t) => t.length >= MIN_CONTENT_TERM_LENGTH);
  // A probed catalog was not matched on its own text, so keep only the agents
  // it returned that actually share a content word with the query.
  const onTopicProbed = probed.candidates.filter((c) => termOverlapScore(entryText(c.entry), contentTerms) > 0);
  const scored = [...ranked.candidates, ...onTopicProbed]
    .map((c) => toAgentCandidate(c, queryTerms, maxOrgRank))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    query,
    count: scored.length,
    candidates: scored,
    resolved: scored[0] ?? null,
    referrals: ranked.finders.map(toFinderReferral),
    orgsQueried: rankedOrgs.length,
    orgsUnreachable: ranked.unreachable,
    tookMs: Date.now() - start,
  };
}
