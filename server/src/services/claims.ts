import { buildConfig } from '../config/index.js';
import { isProven, type Organization } from '../db/queries/organizations.js';

/**
 * An unproven org that has held its org_id slug longer than the hold period
 * gives the slug up. Suspending it does not extend the hold: an unproven claim
 * is never published, so keeping it only serves to block someone else.
 *
 * Shared by registration (which then releases the slug) and the read-only
 * availability check, so both agree on when an org_id is free.
 */
export function isAbandonedClaim(org: Organization, now: Date = new Date()): boolean {
  // An org that ever proved ownership is a real org that may have lost its
  // proof (e.g. a domain change awaiting re-verification) — never auto-deleted.
  if (org.everProven || isProven(org)) return false;
  const holdMs = buildConfig().claims.unprovenSlugHoldHours * 60 * 60 * 1000;
  return now.getTime() - org.createdAt.getTime() >= holdMs;
}
