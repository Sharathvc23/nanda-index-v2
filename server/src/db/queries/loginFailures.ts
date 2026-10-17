import { getSql } from '../client.js';
import { normalizeEmail } from './users.js';

/**
 * Failed-login tracking keyed by (email, client IP).
 *
 * Why not per account: a per-account counter lets anyone lock any user out
 * just by sending bad passwords for their email. Keying by IP as well means an
 * attacker only ever locks themselves. Keying by the *submitted email* (rather
 * than user_id) means unknown emails lock exactly like real ones, so a 429
 * never confirms that an account exists.
 */

/** Longest a single lock may last, however long the failure streak gets. */
const MAX_LOCKOUT_MINUTES = 24 * 60;
/** A streak with no new failure for this long starts over from zero. */
const STREAK_RESET_HOURS = 24;

export interface LockoutPolicy {
  /** Failures (per email+IP) before the first lock. */
  readonly maxAttempts: number;
  /** Length of the first lock; each further failure doubles it. */
  readonly lockoutMinutes: number;
}

/**
 * Lock length after `failedCount` failures: none below the threshold, then
 * lockoutMinutes doubling with every failure past it, capped at a day.
 */
export function lockoutMinutesFor(failedCount: number, policy: LockoutPolicy): number {
  if (failedCount < policy.maxAttempts) return 0;
  const doublings = failedCount - policy.maxAttempts;
  return Math.min(policy.lockoutMinutes * 2 ** doublings, MAX_LOCKOUT_MINUTES);
}

/** True while an active lock exists for this email from this IP. */
export async function isLoginLocked(email: string, ip: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql<{ locked: boolean }[]>`
    SELECT locked_until IS NOT NULL AND locked_until > NOW() AS locked
    FROM login_failures
    WHERE email = ${normalizeEmail(email)} AND ip_address = ${ip}
  `;
  return rows[0]?.locked ?? false;
}

/**
 * Records one failed attempt and, past the threshold, sets an exponentially
 * growing lock. Callers reject while locked, so the count only grows between
 * locks — each lock that expires and is followed by another failure doubles.
 */
export async function recordLoginFailure(
  email: string,
  ip: string,
  policy: LockoutPolicy,
): Promise<void> {
  const sql = getSql();
  const key = normalizeEmail(email);
  const [row] = await sql<{ failedCount: number }[]>`
    INSERT INTO login_failures (email, ip_address, failed_count, last_failed_at)
    VALUES (${key}, ${ip}, 1, NOW())
    ON CONFLICT (email, ip_address) DO UPDATE SET
      failed_count = CASE
        WHEN login_failures.last_failed_at < NOW() - make_interval(hours => ${STREAK_RESET_HOURS})
        THEN 1
        ELSE login_failures.failed_count + 1
      END,
      last_failed_at = NOW()
    RETURNING failed_count
  `;

  const minutes = lockoutMinutesFor(row!.failedCount, policy);
  if (minutes === 0) return;
  await sql`
    UPDATE login_failures
    SET locked_until = NOW() + make_interval(mins => ${minutes})
    WHERE email = ${key} AND ip_address = ${ip}
  `;
}

/** Clears the streak for one email+IP (successful login from that IP). */
export async function clearLoginFailures(email: string, ip: string): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM login_failures WHERE email = ${normalizeEmail(email)} AND ip_address = ${ip}
  `;
}

/** Clears every IP's streak for an email (completed password reset). */
export async function clearAllLoginFailures(email: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM login_failures WHERE email = ${normalizeEmail(email)}`;
}
