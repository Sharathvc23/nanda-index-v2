import { TRUST_MANIFEST_SCHEMA, type PublisherBlock, type TrustManifest } from './index-record.js';

/**
 * One ranked candidate agent returned by GET /api/v1/agentic-search. Uses the
 * paper's AI Catalog entry field names (displayName, trustManifest, …) plus the
 * search-result `provenance` and `score` — the same shape as an ARD search result.
 */
export interface AgentCandidate {
  identifier: string;
  displayName: string;
  type: string;
  url: string;
  description: string | null;
  tags: string[];
  /** Publisher of the index entry the candidate was found through. */
  publisher?: PublisherBlock;
  trustManifest?: TrustManifest;
  /** Always false alongside trustManifest: self-asserted, not verified by the index. */
  trustManifestVerified?: false;
  provenance: {
    orgId: string;
    registryUrl: string;
    basis: 'agent_search' | 'single_agent_org' | 'federated';
  };
  score: number;
}

/** A matching ARD finder the requester should query directly. */
export interface FinderReferral {
  identifier: string;
  displayName: string;
  searchUrl: string;
}

/** GET /api/v1/agentic-search?q=&limit= — response envelope. */
export interface AgenticSearchResponse {
  query: string;
  count: number;
  candidates: AgentCandidate[];
  resolved: AgentCandidate | null;
  referrals: FinderReferral[];
  orgsQueried: number;
  orgsUnreachable: string[];
  tookMs: number;
}

export const agenticSearchQuerySchema = {
  type: 'object',
  required: ['q'],
  additionalProperties: false,
  properties: {
    q:     { type: 'string', minLength: 2, maxLength: 128 },
    limit: { type: 'integer', minimum: 1, maximum: 50 },
  },
} as const;

const AGENT_CANDIDATE_SCHEMA = {
  type: 'object',
  required: ['identifier', 'displayName', 'type', 'url', 'description', 'tags', 'provenance', 'score'],
  properties: {
    identifier:  { type: 'string' },
    displayName: { type: 'string' },
    type:        { type: 'string' },
    url:         { type: 'string' },
    description: { type: ['string', 'null'] },
    tags:        { type: 'array', items: { type: 'string' } },
    publisher: {
      type: 'object',
      properties: {
        identifier:   { type: 'string' },
        displayName:  { type: 'string' },
        identityType: { type: 'string' },
      },
    },
    trustManifest: TRUST_MANIFEST_SCHEMA,
    trustManifestVerified: { type: 'boolean' },
    provenance: {
      type: 'object',
      required: ['orgId', 'registryUrl', 'basis'],
      properties: {
        orgId:       { type: 'string' },
        registryUrl: { type: 'string' },
        basis:       { type: 'string', enum: ['agent_search', 'single_agent_org', 'federated'] },
      },
    },
    score: { type: 'number' },
  },
} as const;

export const agenticSearchResponseSchema = {
  type: 'object',
  required: ['query', 'count', 'candidates', 'resolved', 'referrals', 'orgsQueried', 'orgsUnreachable', 'tookMs'],
  additionalProperties: false,
  properties: {
    query:      { type: 'string' },
    count:      { type: 'integer', minimum: 0 },
    candidates: { type: 'array', items: AGENT_CANDIDATE_SCHEMA },
    resolved:   { anyOf: [AGENT_CANDIDATE_SCHEMA, { type: 'null' }] },
    referrals: {
      type: 'array',
      items: {
        type: 'object',
        required: ['identifier', 'displayName', 'searchUrl'],
        properties: {
          identifier:  { type: 'string' },
          displayName: { type: 'string' },
          searchUrl:   { type: 'string' },
        },
      },
    },
    orgsQueried:     { type: 'integer', minimum: 0 },
    orgsUnreachable: { type: 'array', items: { type: 'string' } },
    tookMs:          { type: 'integer', minimum: 0 },
  },
} as const;
