import { describe, it, expect } from 'vitest';
import { jsonDepthExceeds, oversizedJsonField, MAX_CLIENT_JSON_BYTES, MAX_CLIENT_JSON_DEPTH } from '../../src/lib/jsonLimits.js';
import { isReservedOrgId } from '../../src/lib/reservedOrgIds.js';
import { parseAdminEmails } from '../../src/config/index.js';

function nested(depth: number): unknown {
  return depth <= 1 ? { v: 1 } : { c: nested(depth - 1) };
}

describe('jsonDepthExceeds', () => {
  it('treats scalars as depth 0 and each object/array level as one more', () => {
    expect(jsonDepthExceeds('x', 0)).toBe(false);
    expect(jsonDepthExceeds({}, 0)).toBe(true);
    expect(jsonDepthExceeds([[1]], 2)).toBe(false);
    expect(jsonDepthExceeds([[[1]]], 2)).toBe(true);
  });

  it('stops early on very deep input instead of recursing all the way down', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 100_000; i++) deep = [deep];
    expect(jsonDepthExceeds(deep, MAX_CLIENT_JSON_DEPTH)).toBe(true);
  });
});

describe('oversizedJsonField', () => {
  it('returns null when every field is within limits', () => {
    expect(oversizedJsonField({ extensions: nested(6), entry_data: undefined }, ['extensions', 'entry_data'])).toBeNull();
  });

  it('names the first field that is too deep', () => {
    expect(oversizedJsonField({ entry_data: nested(7) }, ['extensions', 'entry_data'])).toMatch(/entry_data/);
  });

  it('names a field whose serialized size is over the byte cap', () => {
    const big = { blob: 'x'.repeat(MAX_CLIENT_JSON_BYTES) };
    expect(oversizedJsonField({ extensions: big }, ['extensions'])).toMatch(/extensions/);
  });

  it('counts bytes, not characters', () => {
    const multiByte = { blob: '€'.repeat(Math.ceil(MAX_CLIENT_JSON_BYTES / 3) + 1) };
    expect(oversizedJsonField({ extensions: multiByte }, ['extensions'])).not.toBeNull();
  });
});

describe('isReservedOrgId', () => {
  it.each(['admin', 'nanda', 'openai', 'anthropic', 'host39', 'support'])('reserves %s', (id) => {
    expect(isReservedOrgId(id)).toBe(true);
  });

  it.each(['acme', 'nanda-labs-demo', 'my-openai-bot'])('allows %s', (id) => {
    expect(isReservedOrgId(id)).toBe(false);
  });
});

describe('parseAdminEmails', () => {
  it('splits, trims, lowercases and drops blanks', () => {
    expect(parseAdminEmails(' A@x.com, ,b@Y.org ')).toEqual(['a@x.com', 'b@y.org']);
  });

  it('is empty when unset', () => {
    expect(parseAdminEmails('')).toEqual([]);
  });
});
