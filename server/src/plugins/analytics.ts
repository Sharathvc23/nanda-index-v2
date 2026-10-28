import type { FastifyInstance } from 'fastify';
import { buildConfig } from '../config/index.js';
import { createAnalytics, type Analytics } from '../services/analytics.js';

declare module 'fastify' {
  interface FastifyInstance {
    analytics: Analytics;
  }
}

/**
 * Decorates the Fastify instance with `fastify.analytics` (services/analytics.ts)
 * and flushes queued events on graceful shutdown. Without POSTHOG_API_KEY it
 * is a no-op, so routes can capture unconditionally.
 *
 * Call directly on the root instance (not via fastify.register) so the
 * decoration is visible to all child plugins without needing fastify-plugin.
 */
export async function registerAnalytics(fastify: FastifyInstance): Promise<void> {
  const analytics = createAnalytics(buildConfig().analytics, (err) => {
    fastify.log.warn({ err }, 'analytics event delivery failed');
  });
  fastify.decorate('analytics', analytics);
  fastify.addHook('onClose', async () => {
    await analytics.shutdown();
  });
}
