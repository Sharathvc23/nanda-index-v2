import { parseAirUrn } from '../lib/airUrn.js';
import type { RemoteCatalogEntry } from './registryFanout.js';

/**
 * Validation for entries returned by a registrant's own registry during
 * fan-out. Those responses are untrusted input: a malformed entry used to
 * throw inside search and fail every request, and an entry could claim an
 * identifier anchored to another publisher (urn:air:stripe.com:...) or a
 * non-https URL. Bad entries are dropped, never repaired into something the
 * registry did not say.
 */

/** Largest registry response read during fan-out; bigger bodies are refused. */
export const MAX_REMOTE_BODY_BYTES = 256 * 1024;

const MAX_IDENTIFIER = 512;
const MAX_DISPLAY_NAME = 255;
const MAX_MEDIA_TYPE = 128;
const MAX_URL = 2048;
const MAX_DESCRIPTION = 2000;
const MAX_TAGS = 20;
const MAX_TAG = 64;
const MAX_VERSION = 64;

function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function httpsUrl(value: unknown): string | null {
  const raw = boundedString(value, MAX_URL);
  if (!raw) return null;
  try {
    return new URL(raw).protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * A bare id ("flights") is qualified later under the registry's own domain.
 * A urn:air: identifier must already be anchored there. Other URN schemes are
 * dropped: they carry no publisher anchor we can check against the registry.
 */
function anchoredIdentifier(value: unknown, orgDomain: string | null): string | null {
  const raw = boundedString(value, MAX_IDENTIFIER);
  if (!raw) return null;
  if (!raw.toLowerCase().startsWith('urn:')) return raw;
  if (!orgDomain) return null;
  try {
    const parsed = parseAirUrn(raw);
    return parsed.publisherDomain === orgDomain.toLowerCase() ? parsed.urn : null;
  } catch {
    return null;
  }
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0 && t.length <= MAX_TAG)
    .slice(0, MAX_TAGS);
}

/** The entry with only well-formed fields, or null if it cannot be used at all. */
export function sanitizeRemoteEntry(raw: unknown, orgDomain: string | null): RemoteCatalogEntry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;

  const identifier = anchoredIdentifier(entry['identifier'], orgDomain);
  const displayName = boundedString(entry['displayName'], MAX_DISPLAY_NAME);
  const mediaType = boundedString(entry['mediaType'], MAX_MEDIA_TYPE);
  const url = httpsUrl(entry['url']);
  if (!identifier || !displayName || !mediaType || !url) return null;

  const description = typeof entry['description'] === 'string'
    ? entry['description'].slice(0, MAX_DESCRIPTION)
    : null;

  return {
    identifier,
    displayName,
    mediaType,
    url,
    description,
    tags: cleanTags(entry['tags']),
    version: boundedString(entry['version'], MAX_VERSION),
  };
}

/**
 * Reads at most MAX_REMOTE_BODY_BYTES of a response as JSON. Returns
 * undefined when the body is too large or not JSON, so a registry cannot make
 * the index buffer an arbitrarily large document.
 */
export async function readCappedJson(res: Response): Promise<unknown> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_REMOTE_BODY_BYTES) return undefined;
  if (!res.body) return undefined;

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REMOTE_BODY_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}
