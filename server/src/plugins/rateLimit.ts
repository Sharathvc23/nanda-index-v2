import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { buildConfig } from '../config/index.js';

/**
 * Registers @fastify/rate-limit in opt-in mode (`global: false`).
 *
 * Only routes that declare `config.rateLimit` are throttled, keyed by client
 * IP. Auth mutation routes (login/register/forgot/reset) opt in to blunt
 * brute-force and mass-signup attacks; public read routes opt in via
 * publicReadRateLimit / searchRateLimit below so one client cannot scrape or
 * hammer the index (agentic and ARD search each fan out to many remote
 * registries, so they get a tighter budget).
 *
 * The default max/window come from config so tests can tune them via env.
 */
export async function registerRateLimit(fastify: FastifyInstance): Promise<void> {
  const config = buildConfig();
  await fastify.register(rateLimit, {
    global: false,
    max: config.auth.rateLimitMax,
    timeWindow: config.auth.rateLimitWindow,
  });
}

interface RouteRateLimit {
  rateLimit: { max: number; timeWindow: string };
}

/** Route `config` for cheap public reads (index list/read, keyword search, resolve, ARD listings). */
export function publicReadRateLimit(): RouteRateLimit {
  const { publicRateLimit } = buildConfig();
  return { rateLimit: { max: publicRateLimit.max, timeWindow: publicRateLimit.window } };
}

/** Route `config` for agentic / ARD search, which fan out to remote registries. */
export function searchRateLimit(): RouteRateLimit {
  const { publicRateLimit } = buildConfig();
  return { rateLimit: { max: publicRateLimit.searchMax, timeWindow: publicRateLimit.window } };
}
