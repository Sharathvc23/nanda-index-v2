import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';

/**
 * Public read endpoints are rate limited per IP. The limits are read when
 * routes register, so this suite lowers them before building its own server
 * (tests/setup.ts raises them for every other suite).
 */
describe('public read rate limits', () => {
  let fastify: FastifyInstance;
  const saved = {
    public: process.env['PUBLIC_RATE_LIMIT_MAX'],
    search: process.env['SEARCH_RATE_LIMIT_MAX'],
  };

  beforeAll(async () => {
    process.env['PUBLIC_RATE_LIMIT_MAX'] = '2';
    process.env['SEARCH_RATE_LIMIT_MAX'] = '1';
    const built = await buildServer({ logger: false });
    fastify = built.fastify;
    await fastify.ready();
  });

  afterAll(async () => {
    process.env['PUBLIC_RATE_LIMIT_MAX'] = saved.public;
    process.env['SEARCH_RATE_LIMIT_MAX'] = saved.search;
    await fastify.close();
    const { closeSql } = await import('../../src/db/client.js');
    await closeSql();
  });

  const hit = (method: 'GET' | 'POST', url: string, ip: string, payload?: unknown) =>
    fastify.inject({ method, url, remoteAddress: ip, ...(payload ? { payload } : {}) });

  it.each([
    ['/api/v1/index'],
    ['/api/v1/search?q=ratelimit'],
    ['/api/v1/resolve?locator=urn:air:ratelimit.example.com:agent:x'],
  ])('GET %s returns 429 past PUBLIC_RATE_LIMIT_MAX', async (url) => {
    const ip = `10.1.0.${Math.floor(Math.random() * 250) + 1}`;
    expect((await hit('GET', url, ip)).statusCode).not.toBe(429);
    expect((await hit('GET', url, ip)).statusCode).not.toBe(429);
    expect((await hit('GET', url, ip)).statusCode).toBe(429);
  });

  it('agentic search uses the tighter SEARCH_RATE_LIMIT_MAX', async () => {
    const url = '/api/v1/agentic-search?q=zzznomatchratelimit';
    expect((await hit('GET', url, '10.2.0.1')).statusCode).toBe(200);
    expect((await hit('GET', url, '10.2.0.1')).statusCode).toBe(429);
  });

  it('ARD search uses the tighter SEARCH_RATE_LIMIT_MAX', async () => {
    const payload = { query: { text: 'zzznomatchratelimit' } };
    expect((await hit('POST', '/api/ard/search', '10.3.0.1', payload)).statusCode).toBe(200);
    expect((await hit('POST', '/api/ard/search', '10.3.0.1', payload)).statusCode).toBe(429);
  });

  it('limits each client IP separately', async () => {
    const url = '/api/v1/agentic-search?q=zzznomatchratelimit';
    expect((await hit('GET', url, '10.4.0.1')).statusCode).toBe(200);
    expect((await hit('GET', url, '10.4.0.2')).statusCode).toBe(200);
  });
});
