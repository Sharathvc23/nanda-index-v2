/**
 * Caps on client-supplied free-form JSON (extensions, entry_data,
 * trust_manifest). The JSON schemas allow arbitrary objects there, and every
 * byte is stored and served back on public list/search responses, so an
 * unbounded blob would let one registrant bloat every page of the index.
 * Depth is capped too: deeply nested values are expensive to (de)serialize
 * and render, and no catalog field legitimately needs more than a few levels.
 */
export const MAX_CLIENT_JSON_BYTES = 16 * 1024;
export const MAX_CLIENT_JSON_DEPTH = 6;

/**
 * True when `value` nests objects/arrays more than `maxDepth` levels (a
 * scalar is depth 0, `{}` depth 1). Walks level by level and stops as soon as
 * the limit is crossed, so hostile input cannot blow the stack.
 */
export function jsonDepthExceeds(value: unknown, maxDepth: number): boolean {
  let level: unknown[] = [value];
  for (let depth = 1; ; depth++) {
    const containers = level.filter((v): v is object => typeof v === 'object' && v !== null);
    if (containers.length === 0) return false;
    if (depth > maxDepth) return true;
    level = containers.flatMap((c) => Object.values(c));
  }
}

/**
 * Returns a message naming the first of `fields` in `body` that is over the
 * byte or depth cap, or null when all are within limits (absent fields pass).
 */
export function oversizedJsonField(
  body: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): string | null {
  for (const field of fields) {
    const value = body[field];
    if (value === undefined || value === null) continue;
    if (jsonDepthExceeds(value, MAX_CLIENT_JSON_DEPTH)) {
      return `${field} is nested deeper than ${MAX_CLIENT_JSON_DEPTH} levels`;
    }
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_CLIENT_JSON_BYTES) {
      return `${field} is larger than ${MAX_CLIENT_JSON_BYTES / 1024} KB when serialized`;
    }
  }
  return null;
}
