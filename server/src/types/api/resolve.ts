import type { IndexEntry } from './index-entry.js';
import { INDEX_ENTRY_SCHEMA } from './index-entry.js';

/**
 * How the locator was matched:
 *   exact     — an entry is registered under exactly this identifier.
 *   publisher — no exact entry; the publisher's catalog/registry entry is
 *               returned so the requester can look the resource up inside it.
 */
export type ResolveMatch = 'exact' | 'publisher';

export interface ResolveResponse {
  /** The normalised urn:air: identifier that was resolved. */
  readonly locator: string;
  /** The locator's short-name — the key to look up inside a catalog on a publisher match. */
  readonly identifier: string;
  readonly match: ResolveMatch;
  /** The resolution entry as an AI Catalog entry (paper §5.4) — same shape as GET /api/v1/index. */
  readonly entry: IndexEntry;
}

export const resolveResponseSchema = {
  type: 'object',
  required: ['locator', 'identifier', 'match', 'entry'],
  properties: {
    locator:    { type: 'string', minLength: 1 },
    identifier: { type: 'string', minLength: 1 },
    match:      { type: 'string', enum: ['exact', 'publisher'] },
    entry:      INDEX_ENTRY_SCHEMA,
  },
} as const;
