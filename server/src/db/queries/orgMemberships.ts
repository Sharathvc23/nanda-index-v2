import { getSql } from '../client.js';

export interface OrgMembership {
  id: string;
  userId: string;
  orgId: string;
  role: 'admin' | 'member';
  createdAt: Date;
}

/**
 * Inserts a new org membership.
 * Returns the inserted record.
 */
export async function insertMembership(
  userId: string,
  orgId: string,
  role: 'admin' | 'member' = 'admin',
): Promise<OrgMembership> {
  const sql = getSql();
  const rows = await sql<OrgMembership[]>`
    INSERT INTO org_memberships (user_id, org_id, role)
    VALUES (${userId}, ${orgId}, ${role})
    RETURNING *
  `;
  return rows[0]!;
}

/**
 * Whether anyone can still administer this org.
 *
 * `user_id` is `REFERENCES users(id) ON DELETE CASCADE`, so removing a user row
 * takes its memberships with it while the `organizations` row survives. An org
 * can therefore reach zero admins, and `requireOrgRole('admin')` then refuses
 * every write to it — including the delete that would free the slug.
 */
export async function hasAdminMembership(orgId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM org_memberships WHERE org_id = ${orgId} AND role = 'admin'
    ) AS exists
  `;
  return rows[0]?.exists ?? true; // unreadable → assume administered, never claimable
}

export interface MembershipWithOrg extends OrgMembership {
  displayName: string;
  status: 'pending' | 'active' | 'suspended';
  /** Null for a personal (domain-less) entry. */
  domain: string | null;
  emailVerified: boolean;
  domainVerified: boolean;
}

/**
 * Returns all memberships for a user with key org fields joined.
 */
export async function findMembershipsByUserId(
  userId: string,
): Promise<MembershipWithOrg[]> {
  const sql = getSql();
  return sql<MembershipWithOrg[]>`
    SELECT m.*, o.display_name, o.status, o.domain, o.email_verified, o.domain_verified
    FROM org_memberships m
    JOIN organizations o ON o.org_id = m.org_id
    WHERE m.user_id = ${userId}
    ORDER BY m.created_at DESC
  `;
}

/**
 * Checks whether a user is a member of an org.
 * Returns the membership or null.
 */
export async function checkMembership(
  userId: string,
  orgId: string,
): Promise<OrgMembership | null> {
  const sql = getSql();
  const rows = await sql<OrgMembership[]>`
    SELECT * FROM org_memberships
    WHERE user_id = ${userId} AND org_id = ${orgId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}
