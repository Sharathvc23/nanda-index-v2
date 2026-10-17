import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildConfig } from '../config/index.js';
import { findUserById } from '../db/queries/users.js';
import type { JwtPayload } from '../plugins/jwt.js';

/**
 * Providers whose email we trust as proof of identity. Password sign-up never
 * verifies the address, so a password account on an ADMIN_EMAILS address
 * would let anyone who registers it first act as an operator.
 */
const VERIFIED_EMAIL_PROVIDERS: readonly string[] = ['google', 'github'];

/**
 * True when the user is an index operator: an OAuth-authenticated account
 * whose stored email is listed in ADMIN_EMAILS. Reads the user row rather
 * than the JWT's email claim, so the check reflects the current account.
 */
export async function isOperator(userId: string): Promise<boolean> {
  const { adminEmails } = buildConfig();
  if (adminEmails.length === 0) return false;
  const user = await findUserById(userId);
  if (!user || !VERIFIED_EMAIL_PROVIDERS.includes(user.provider)) return false;
  return adminEmails.includes(user.email.trim().toLowerCase());
}

/** preHandler (after fastify.authenticate): 403 unless the caller is an operator. */
export async function requireOperator(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { userId } = request.user as JwtPayload;
  if (await isOperator(userId)) return;
  reply.code(403).send({ error: 'FORBIDDEN', detail: 'index operator access required' });
}
