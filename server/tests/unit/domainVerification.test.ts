import { describe, it, expect } from 'vitest';
import {
  challengeRecordName,
  challengeRecordValue,
  lookupDomainToken,
  anyOfResolvers,
  PUBLIC_DNS_SERVERS,
  CHALLENGE_PREFIX,
  VALUE_PREFIX,
  type TxtResolver,
} from '../../src/services/domainVerification.js';

describe('domainVerification — record construction', () => {
  it('builds the challenge record name under the _nanda-challenge label', () => {
    expect(challengeRecordName('acme.com')).toBe(`${CHALLENGE_PREFIX}.acme.com`);
    expect(challengeRecordName('sub.acme.com')).toBe(`${CHALLENGE_PREFIX}.sub.acme.com`);
  });

  it('builds the namespaced TXT value from a token', () => {
    expect(challengeRecordValue('abc123')).toBe(`${VALUE_PREFIX}abc123`);
  });
});

describe('domainVerification — lookupDomainToken', () => {
  const domain = 'acme.com';
  const token = 'deadbeef';
  const expected = challengeRecordValue(token);

  it('verifies when the expected value is present', async () => {
    const resolve: TxtResolver = async () => [[expected]];
    const result = await lookupDomainToken(domain, expected, resolve);
    expect(result.verified).toBe(true);
    expect(result.found).toEqual([expected]);
  });

  it('queries the correct challenge record name', async () => {
    let queried = '';
    const resolve: TxtResolver = async (name) => { queried = name; return [[expected]]; };
    await lookupDomainToken(domain, expected, resolve);
    expect(queried).toBe(challengeRecordName(domain));
  });

  it('joins multi-chunk TXT records before matching', async () => {
    const resolve: TxtResolver = async () => [[VALUE_PREFIX, token]];
    const result = await lookupDomainToken(domain, expected, resolve);
    expect(result.verified).toBe(true);
  });

  it('finds the value among several unrelated TXT records', async () => {
    const resolve: TxtResolver = async () => [
      ['v=spf1 include:_spf.google.com ~all'],
      ['some-other=thing'],
      [expected],
    ];
    const result = await lookupDomainToken(domain, expected, resolve);
    expect(result.verified).toBe(true);
    expect(result.found).toHaveLength(3);
  });

  it('does not verify when the token does not match', async () => {
    const resolve: TxtResolver = async () => [[challengeRecordValue('wrong-token')]];
    const result = await lookupDomainToken(domain, expected, resolve);
    expect(result.verified).toBe(false);
    expect(result.found).toEqual([challengeRecordValue('wrong-token')]);
  });

  it('treats a DNS resolution error (ENOTFOUND) as not verified, not a throw', async () => {
    const resolve: TxtResolver = async () => { throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' }); };
    const result = await lookupDomainToken(domain, expected, resolve);
    expect(result.verified).toBe(false);
    expect(result.found).toEqual([]);
  });

  it('treats an empty record set as not verified', async () => {
    const resolve: TxtResolver = async () => [];
    const result = await lookupDomainToken(domain, expected, resolve);
    expect(result.verified).toBe(false);
  });
});

describe('domainVerification — anyOfResolvers', () => {
  const name = '_nanda-challenge.acme.com';
  const notFound = () => Promise.reject(Object.assign(new Error('not found'), { code: 'ENOTFOUND' }));

  it('returns the records from a resolver that has them when another still serves a cached miss', async () => {
    // The production failure: the host's resolver had cached NXDOMAIN from
    // before the record was fixed, while public resolvers already saw it.
    const stale: TxtResolver = notFound;
    const fresh: TxtResolver = async () => [['nanda-verify=abc']];
    const result = await anyOfResolvers([stale, fresh])(name);
    expect(result).toEqual([['nanda-verify=abc']]);
  });

  it('merges records seen by different resolvers without duplicates', async () => {
    const a: TxtResolver = async () => [['nanda-verify=old'], ['v=spf1 ~all']];
    const b: TxtResolver = async () => [['nanda-verify=new'], ['v=spf1 ~all']];
    const result = await anyOfResolvers([a, b])(name);
    expect(result.map((r) => r.join(''))).toEqual(['nanda-verify=old', 'v=spf1 ~all', 'nanda-verify=new']);
  });

  it('asks every resolver for the same name', async () => {
    const asked: string[] = [];
    const spy: TxtResolver = async (n) => { asked.push(n); return []; };
    await anyOfResolvers([spy, spy, spy])(name);
    expect(asked).toEqual([name, name, name]);
  });

  it('rejects only when every resolver fails, so the caller still reports "not found"', async () => {
    await expect(anyOfResolvers([notFound, notFound])(name)).rejects.toThrow();
  });

  it('treats an empty answer from one resolver as no records, not a failure', async () => {
    const empty: TxtResolver = async () => [];
    await expect(anyOfResolvers([empty, notFound])(name)).resolves.toEqual([]);
  });

  it('verifies end to end through lookupDomainToken when only a public resolver sees the record', async () => {
    const expected = challengeRecordValue('feed');
    const result = await lookupDomainToken('acme.com', expected, anyOfResolvers([notFound, async () => [[expected]]]));
    expect(result.verified).toBe(true);
  });
});

describe('domainVerification — PUBLIC_DNS_SERVERS', () => {
  it('lists independent public resolvers by IP, so verification does not depend on the host resolver alone', () => {
    expect(PUBLIC_DNS_SERVERS.length).toBeGreaterThanOrEqual(2);
    for (const server of PUBLIC_DNS_SERVERS) expect(server).toMatch(/^\d{1,3}(\.\d{1,3}){3}$/);
  });
});
