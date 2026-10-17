/**
 * org_id slugs a regular registrant may not claim. An org_id appears in URLs
 * (/api/v1/index/<org_id>, the dashboard) and in agentic-search provenance,
 * so a slug like "openai" or "security" lends an entry authority it has not
 * earned: the index's own names, infrastructure words, and well-known
 * organisations likely to be impersonated. Operators (ADMIN_EMAILS) may still
 * register them, e.g. on a real organisation's behalf. Exact match only —
 * "my-openai-bot" is descriptive, not impersonation.
 */
const RESERVED_ORG_IDS: ReadonlySet<string> = new Set([
  // The index and its hosts
  'nanda', 'nandaindex', 'nanda-index', 'projectnanda', 'project-nanda', 'host39', 'mit',
  // Infrastructure / UI words
  'admin', 'administrator', 'api', 'www', 'root', 'system', 'operator', 'staff',
  'support', 'security', 'help', 'login', 'logout', 'signup', 'register', 'dashboard',
  'auth', 'oauth', 'account', 'settings', 'status', 'docs', 'mail', 'email', 'abuse', 'official',
  // Well-known organisations
  'google', 'openai', 'anthropic', 'microsoft', 'apple', 'amazon', 'aws', 'cisco', 'meta',
  'facebook', 'nvidia', 'ibm', 'oracle', 'github',
]);

export function isReservedOrgId(orgId: string): boolean {
  return RESERVED_ORG_IDS.has(orgId.toLowerCase());
}
