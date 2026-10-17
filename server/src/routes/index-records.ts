import type { FastifyInstance } from 'fastify';
import { findByOrgId, listListedEntries, markEmailVerifiedByToken, toIndexEntry, toIndexRecord } from '../db/queries/organizations.js';
import { INDEX_RECORD_SCHEMA } from '../types/api/index-record.js';
import { INDEX_ENTRY_SCHEMA } from '../types/api/index-entry.js';
import { apiErrorSchema } from '../types/api/common.js';
import { publicReadRateLimit } from '../plugins/rateLimit.js';

/** Page size when ?limit is omitted, and the most one request may ask for. */
const DEFAULT_INDEX_PAGE_SIZE = 100;
const MAX_INDEX_PAGE_SIZE = 500;

interface IndexListQuerystring {
  limit?: number;
  offset?: number;
}

/**
 * Public read-only routes for the NANDA Index.
 *
 * GET /api/v1/index           — list listed entries (active, not moderated), paged
 *                               by ?limit/&offset, in the paper's AI Catalog entry shape
 * GET /api/v1/index/:org_id   — get a single entry (same shape), 404 on miss or takedown
 * GET /api/v1/verify-email    — mark org contact email verified (also activates
 *                                personal/no-domain orgs; domain-based orgs
 *                                still need domain verification separately)
 */
export async function registerIndexRecordRoutes(fastify: FastifyInstance): Promise<void> {
  // List index entries. Paged so one request cannot pull the whole index; the
  // body stays a bare array (existing clients keep working) and the total
  // rides in X-Total-Count.
  fastify.get<{ Querystring: IndexListQuerystring }>('/api/v1/index', {
    config: publicReadRateLimit(),
    schema: {
      tags: ['index'],
      summary: 'List index entries (AI Catalog entry shape), paged; total in X-Total-Count',
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit:  { type: 'integer', minimum: 1, maximum: MAX_INDEX_PAGE_SIZE, default: DEFAULT_INDEX_PAGE_SIZE },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
      response: {
        200: { type: 'array', items: INDEX_ENTRY_SCHEMA },
        400: apiErrorSchema,
      },
    },
  }, async (request, reply) => {
    const { rows, total } = await listListedEntries(
      request.query.limit ?? DEFAULT_INDEX_PAGE_SIZE,
      request.query.offset ?? 0,
    );
    return reply.header('X-Total-Count', String(total)).send(rows.map(toIndexEntry));
  });

  // Get a single index record by org_id. A 'hidden' entry is still readable
  // here (hiding only affects listings); a taken-down one is not.
  fastify.get<{ Params: { org_id: string } }>('/api/v1/index/:org_id', {
    config: publicReadRateLimit(),
    schema: {
      tags: ['index'],
      summary: 'Get a single index entry (AI Catalog entry shape)',
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
    const org = await findByOrgId(request.params.org_id);
    if (!org || org.moderation === 'takedown') {
      return reply.code(404).send({ error: 'NOT_FOUND', detail: `org "${request.params.org_id}" not found` });
    }
    return reply.send(toIndexEntry(org));
  });

  // Email verification — marks contact email verified. Activates personal
  // (no-domain) orgs outright; domain-based orgs still need domain verification.
  fastify.get<{ Querystring: { token?: string } }>('/api/v1/verify-email', {
    schema: {
      tags: ['auth'],
      summary: 'Verify org contact email (activates personal orgs; others still need domain verification)',
      querystring: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string', minLength: 1 } },
      },
      response: {
        200: INDEX_RECORD_SCHEMA,
        400: apiErrorSchema,
        404: apiErrorSchema,
      },
    },
  }, async (request, reply) => {
    const { token } = request.query;
    if (!token) {
      return reply.code(400).send({ error: 'BAD_REQUEST', detail: 'token query parameter is required' });
    }
    const org = await markEmailVerifiedByToken(token);
    if (!org) {
      return reply.code(404).send({ error: 'NOT_FOUND', detail: 'verification token not found or already used' });
    }
    return reply.send(toIndexRecord(org));
  });
}
