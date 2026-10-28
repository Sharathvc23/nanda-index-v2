import { createHash, randomBytes } from 'node:crypto';
import { getSql } from '../client.js';
import { isProven, type Organization } from './organizations.js';
import { personalAirUrn } from '../../lib/airUrn.js';
import { NANDA_EXTENSION } from '../../lib/entryProfile.js';
import { SINGLE_RESOURCE_MEDIA_TYPES } from '../../lib/mediaTypes.js';
import { CHALLENGE_TTL_MS } from '../../services/domainVerification.js';

export interface RecoveryChallenge {
  id: string;
  organizationId: string;
  userId: string;
  method: 'dns' | 'email';
  subject: string;
  identifier: string;
  tokenHash: string;
  dnsToken: string | null;
  expiresAt: Date;
}

export class RecoveryError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) {
    super(message);
  }
}

export function recoveryTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Ownership is selected from the stored identity, independently of media type. */
function recoveryIdentity(org: Organization): { method: 'dns' | 'email'; subject: string } {
  if (org.domain) return { method: 'dns', subject: org.domain.toLowerCase() };
  const email = org.contactEmail.trim().toLowerCase();
  // Personal publishers are host39/dns too; publisher.identityType is NOT the
  // personal owner's proof. Refuse inconsistent legacy rows rather than send
  // an ownership code to an address not bound to this entry's identity.
  if (org.identifier !== personalAirUrn(email)
    || org.extensions[NANDA_EXTENSION]?.['subjectAccount'] !== email
    || !(SINGLE_RESOURCE_MEDIA_TYPES as readonly string[]).includes(org.mediaType)) {
    throw new RecoveryError(409, 'RECOVERY_UNAVAILABLE', 'personal identity is inconsistent with its registered email');
  }
  return { method: 'email', subject: email };
}

function requireRecoverable(org: Organization): void {
  if (!isProven(org) || org.status === 'pending' || org.moderation === 'takedown') {
    throw new RecoveryError(409, 'RECOVERY_UNAVAILABLE', 'recovery requires a proven, active or suspended entry that is not taken down');
  }
}

/** Issue/reuse this user's proof without revealing whether an admin exists. */
export async function prepareOrgRecovery(orgId: string, userId: string, allowIssue: boolean) {
  const sql = getSql();
  // Bounded cleanup outside the org transaction avoids locking another org's
  // expired proofs while holding this org's row lock.
  await sql`WITH expired AS (
    SELECT id FROM org_recovery_challenges WHERE expires_at <= NOW()
    ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED
  ) DELETE FROM org_recovery_challenges c USING expired WHERE c.id = expired.id`;
  return sql.begin(async (tx) => {
    const [org] = await tx<Organization[]>`SELECT * FROM organizations WHERE org_id = ${orgId} FOR UPDATE`;
    if (!org) throw new RecoveryError(404, 'NOT_FOUND', `org "${orgId}" not found`);
    requireRecoverable(org);
    const identity = recoveryIdentity(org);
    const [existing] = await tx<RecoveryChallenge[]>`
      SELECT * FROM org_recovery_challenges
      WHERE organization_id = ${org.id} AND user_id = ${userId}
        AND method = ${identity.method} AND subject = ${identity.subject}
        AND identifier = ${org.identifier} AND expires_at > clock_timestamp()
    `;
    if (existing) return { org, challenge: existing, emailToken: null, created: false };
    if (!allowIssue) throw new RecoveryError(400, 'INVALID_RECOVERY_PROOF', 'request a new recovery challenge');

    if (identity.method === 'email') {
      // Serialize issuance per org to limit mail even across different accounts.
      const [recent] = await tx`
        SELECT 1 FROM org_recovery_challenges WHERE organization_id = ${org.id}
          AND method = 'email' AND created_at > clock_timestamp() - INTERVAL '1 minute' LIMIT 1
      `;
      if (recent) throw new RecoveryError(429, 'RECOVERY_COOLDOWN', 'a recovery email was sent recently; try again in one minute');
    }
    const token = randomBytes(32).toString('hex');
    const ttlMs = identity.method === 'dns' ? CHALLENGE_TTL_MS : 15 * 60 * 1000;
    const [challenge] = await tx<RecoveryChallenge[]>`
      INSERT INTO org_recovery_challenges
        (organization_id, user_id, method, subject, identifier, token_hash, dns_token, expires_at)
      VALUES (${org.id}, ${userId}, ${identity.method}, ${identity.subject}, ${org.identifier},
        ${recoveryTokenHash(token)}, ${identity.method === 'dns' ? token : null},
        clock_timestamp() + ${ttlMs} * INTERVAL '1 millisecond')
      ON CONFLICT (organization_id, user_id) DO UPDATE SET
        id = gen_random_uuid(), method = EXCLUDED.method, subject = EXCLUDED.subject,
        identifier = EXCLUDED.identifier, token_hash = EXCLUDED.token_hash,
        dns_token = EXCLUDED.dns_token, expires_at = EXCLUDED.expires_at, created_at = clock_timestamp()
      RETURNING *
    `;
    return { org, challenge: challenge!, emailToken: identity.method === 'email' ? token : null, created: true };
  });
}

/** On mail delivery failure, allow a fresh issuance without deleting a newer proof. */
export async function discardRecoveryChallenge(id: string): Promise<void> {
  await getSql()`DELETE FROM org_recovery_challenges WHERE id = ${id}`;
}

/**
 * DNS/email was checked outside the transaction. Recheck every mutable input
 * after locking the org, then grant/promote and consume ALL competing proofs.
 * The row lock also serializes moderation, identity edits and org deletion.
 */
export async function completeOrgRecovery(
  proof: RecoveryChallenge, userId: string, tokenVersion: number,
): Promise<Organization> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const [org] = await tx<Organization[]>`
      SELECT * FROM organizations WHERE id = ${proof.organizationId} FOR UPDATE
    `;
    if (!org) throw new RecoveryError(409, 'RECOVERY_CONFLICT', 'the organization changed; request a new challenge');
    requireRecoverable(org);
    const identity = recoveryIdentity(org);
    // Keep account deletion/revocation from racing a completed proof.
    const [user] = await tx`SELECT id FROM users WHERE id = ${userId}
      AND email_verified AND token_version = ${tokenVersion} FOR SHARE`;
    if (!user) throw new RecoveryError(401, 'UNAUTHORIZED', 'session expired; please sign in again');
    const [current] = await tx<RecoveryChallenge[]>`
      SELECT * FROM org_recovery_challenges
      WHERE id = ${proof.id} AND organization_id = ${org.id} AND user_id = ${userId}
        AND method = ${identity.method} AND subject = ${identity.subject}
        AND identifier = ${org.identifier} AND token_hash = ${proof.tokenHash}
        AND expires_at > clock_timestamp()
      FOR UPDATE
    `;
    if (!current) throw new RecoveryError(409, 'RECOVERY_CONFLICT', 'the proof expired or was consumed; request a new challenge');
    const [membership] = await tx`
      INSERT INTO org_memberships (user_id, org_id, role)
      SELECT ${userId}, ${org.orgId}, 'admin'
      WHERE NOT EXISTS (SELECT 1 FROM org_memberships WHERE org_id = ${org.orgId} AND role = 'admin')
      ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'admin'
      RETURNING id
    `;
    if (!membership) throw new RecoveryError(409, 'ALREADY_ADMINISTERED', 'this organization already has an administrator');
    await tx`DELETE FROM org_recovery_challenges WHERE organization_id = ${org.id}`;
    return org;
  });
}
