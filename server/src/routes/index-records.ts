import type { FastifyInstance } from 'fastify';
import { findAllActive, findByOrgId, markEmailVerifiedByToken, toIndexEntry, toIndexRecord } from '../db/queries/organizations.js';
import { INDEX_RECORD_SCHEMA } from '../types/api/index-record.js';
import { INDEX_ENTRY_SCHEMA } from '../types/api/index-entry.js';
import { apiErrorSchema } from '../types/api/common.js';
import { isLive } from '../services/resolution.js';
import { buildConfig } from '../config/index.js';

/**
 * Public read-only routes for the NANDA Index.
 *
 * GET /api/v1/index           — list all active entries, in the paper's AI Catalog entry shape
 * GET /api/v1/index/:org_id   — get a single live entry (same shape); 404 on
 *                                miss, and for pending, suspended or unproven orgs
 * GET /api/v1/verify-email    — forward an emailed link to the web confirmation page
 * POST /api/v1/verify-email   — mark org contact email verified (also activates
 *                                personal/no-domain orgs; domain-based orgs
 *                                still need domain verification separately)
 */
export async function registerIndexRecordRoutes(fastify: FastifyInstance): Promise<void> {
  // List all active index records
  fastify.get('/api/v1/index', {
    schema: {
      tags: ['index'],
      summary: 'List all active index entries (AI Catalog entry shape)',
      response: {
        200: { type: 'array', items: INDEX_ENTRY_SCHEMA },
      },
    },
  }, async (_request, reply) => {
    const orgs = await findAllActive();
    return reply.send(orgs.map(toIndexEntry));
  });

  // Get a single live index record by org_id
  fastify.get<{ Params: { org_id: string } }>('/api/v1/index/:org_id', {
    schema: {
      tags: ['index'],
      summary: 'Get a single live index entry (AI Catalog entry shape)',
      description: 'Only live entries (active and proven) are public: pending, suspended and unproven entries return 404, the same as an unknown org_id.',
      params: {
        type: 'object',
        required: ['org_id'],
        properties: { org_id: { type: 'string' } },
      },
      response: {
        200: INDEX_ENTRY_SCHEMA,
        404: apiErrorSchema,
      },
    },
  }, async (request, reply) => {
    // Same visibility rule as resolve: pending or suspended entries are not
    // public (and a personal one carries the registrant's email). Owners see
    // their own entry via the authenticated GET /api/v1/orgs/:org_id.
    const org = await findByOrgId(request.params.org_id);
    if (!isLive(org)) {
      return reply.code(404).send({ error: 'NOT_FOUND', detail: `org "${request.params.org_id}" not found` });
    }
    return reply.send(toIndexEntry(org));
  });

  // Links sent before verification moved to the web app point here. Opening a
  // link must not verify (mail scanners open it first and used to consume the
  // single-use token), so this only forwards to the page that asks the
  // recipient to confirm.
  fastify.get<{ Querystring: { token?: string } }>('/api/v1/verify-email', {
    schema: {
      tags: ['auth'],
      summary: 'Forward an emailed verification link to the web confirmation page',
      querystring: {
        type: 'object',
        properties: { token: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const token = encodeURIComponent(request.query.token ?? '');
    return reply.redirect(`${buildConfig().frontendUrl}/verify-email?token=${token}`, 302);
  });

  // Email verification — marks contact email verified. Activates personal
  // (no-domain) orgs outright; domain-based orgs still need domain verification.
  fastify.post<{ Body: { token: string } }>('/api/v1/verify-email', {
    schema: {
      tags: ['auth'],
      summary: 'Verify org contact email (activates personal orgs; others still need domain verification)',
      body: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string', minLength: 1, maxLength: 128 } },
      },
      response: {
        200: INDEX_RECORD_SCHEMA,
        400: apiErrorSchema,
        404: apiErrorSchema,
        409: apiErrorSchema,
      },
    },
  }, async (request, reply) => {
    const { token } = request.body;
    let org;
    try {
      org = await markEmailVerifiedByToken(token);
    } catch (err) {
      // Another registration proved this email first — first proof wins.
      if ((err as { code?: unknown }).code === '23505') {
        return reply.code(409).send({ error: 'CONFLICT', detail: 'this identity was verified by another registration' });
      }
      throw err;
    }
    if (!org) {
      return reply.code(404).send({ error: 'NOT_FOUND', detail: 'verification token not found or already used' });
    }
    return reply.send(toIndexRecord(org));
  });
}
