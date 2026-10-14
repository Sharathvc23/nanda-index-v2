import { Resolver, resolveTxt } from 'node:dns/promises';

/**
 * DNS TXT domain-ownership verification (ACME dns-01 style).
 *
 * To prove control of `example.com`, the registrant publishes a TXT record at
 * `_nanda-challenge.example.com` whose value is `nanda-verify=<token>`, where
 * <token> is the per-org challenge we issued. We then resolve that name and
 * confirm the expected value is present — control of the zone's TXT records is
 * strong evidence of domain ownership.
 */

/** Subdomain label the challenge TXT record lives under. */
export const CHALLENGE_PREFIX = '_nanda-challenge';

/** Value prefix so the record is self-describing and namespaced. */
export const VALUE_PREFIX = 'nanda-verify=';

/** How long an issued challenge stays valid — DNS propagation can be slow. */
export const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The fully-qualified TXT record name the user must create for a domain. */
export function challengeRecordName(domain: string): string {
  return `${CHALLENGE_PREFIX}.${domain}`;
}

/** The exact TXT value the user must publish for a given challenge token. */
export function challengeRecordValue(token: string): string {
  return `${VALUE_PREFIX}${token}`;
}

/** Injectable resolver — defaults to Node's DNS, overridable in tests. */
export type TxtResolver = (name: string) => Promise<string[][]>;

export interface DomainLookupResult {
  /** Whether the expected challenge value was found among the TXT records. */
  readonly verified: boolean;
  /** Flattened TXT records observed at the challenge name (for diagnostics). */
  readonly found: readonly string[];
}

/**
 * Public recursive resolvers asked alongside the host's own (Cloudflare, Google,
 * Quad9). The host resolver alone is not enough: when a registrant first
 * publishes the record at the wrong name and then fixes it, the host's resolver
 * keeps serving its cached "not found" for up to the zone's negative TTL (an
 * hour is common), and verification fails against a correct record.
 */
export const PUBLIC_DNS_SERVERS: readonly string[] = ['1.1.1.1', '8.8.8.8', '9.9.9.9'];

/** Per-query timeout for a public resolver, so an unreachable one cannot stall verification. */
const PUBLIC_RESOLVER_TIMEOUT_MS = 2500;

/** A TxtResolver that asks exactly the given DNS servers. */
export function serverTxtResolver(servers: readonly string[]): TxtResolver {
  const resolver = new Resolver({ timeout: PUBLIC_RESOLVER_TIMEOUT_MS, tries: 1 });
  resolver.setServers([...servers]);
  return (name) => resolver.resolveTxt(name);
}

/**
 * Asks every resolver in parallel and merges what they saw. It rejects only if
 * every one of them fails, so a single stale cache or unreachable server cannot
 * hide a record another resolver can already see.
 */
export function anyOfResolvers(resolvers: readonly TxtResolver[]): TxtResolver {
  return async (name) => {
    const results = await Promise.allSettled(resolvers.map((resolve) => resolve(name)));
    const answered = results.filter(
      (r): r is PromiseFulfilledResult<string[][]> => r.status === 'fulfilled',
    );
    if (answered.length === 0) {
      const first = results[0];
      throw first && first.status === 'rejected' ? first.reason : new Error(`no TXT records for ${name}`);
    }
    const seen = new Set<string>();
    const merged: string[][] = [];
    for (const { value } of answered) {
      for (const chunks of value) {
        const key = chunks.join('');
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(chunks);
      }
    }
    return merged;
  };
}

/** The resolver verification uses: the host's own plus each public one, independently. */
export function defaultTxtResolver(): TxtResolver {
  return anyOfResolvers([
    (name) => resolveTxt(name),
    ...PUBLIC_DNS_SERVERS.map((server) => serverTxtResolver([server])),
  ]);
}

/**
 * Resolves the challenge TXT record for `domain` and checks whether
 * `expectedValue` is present. A missing record (ENOTFOUND/ENODATA) or any
 * resolver error is treated as "not yet verified" rather than a failure —
 * the caller surfaces a retry-able 400, never a 500.
 *
 * postgres-style TXT records may be split into multiple chunks per record;
 * DNS returns `string[][]`, so each record's chunks are joined before matching.
 */
export async function lookupDomainToken(
  domain: string,
  expectedValue: string,
  resolve: TxtResolver = defaultTxtResolver(),
): Promise<DomainLookupResult> {
  const name = challengeRecordName(domain);

  let records: string[][];
  try {
    records = await resolve(name);
  } catch {
    // ENOTFOUND / ENODATA / SERVFAIL — record not published (yet).
    return { verified: false, found: [] };
  }

  const found = records.map((chunks) => chunks.join(''));
  return { verified: found.includes(expectedValue), found };
}
