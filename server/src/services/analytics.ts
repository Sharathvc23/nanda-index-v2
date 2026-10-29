import { PostHog } from 'posthog-node';
import type { AnalyticsConfig } from '../config/index.js';

/**
 * Product analytics for account and index-entry lifecycle events (PostHog).
 *
 * Every event is personless and carries no personal data: no email, user id,
 * org_id or domain, only what kind of thing happened. They count activity in
 * the index rather than track a visitor, which is why they are sent without
 * the website's consent banner (see the web privacy page, "Analytics").
 */

export type AnalyticsEvent =
  | 'user_signed_up'
  | 'account_verified'
  | 'entry_registered'
  | 'entry_email_verified'
  | 'entry_domain_verified'
  | 'entry_deleted';

export type AnalyticsProperties = Readonly<Record<string, string | number | boolean>>;

export interface Analytics {
  /** Queues an event; never throws and never waits on the network. */
  capture(event: AnalyticsEvent, properties?: AnalyticsProperties): void;
  /** Flushes queued events. Called once, when the server closes. */
  shutdown(): Promise<void>;
}

/** All server events share one distinct id: none of them belongs to a person. */
const DISTINCT_ID = 'nanda-index-api';
const SHUTDOWN_TIMEOUT_MS = 5_000;

const noopAnalytics: Analytics = {
  capture: () => {},
  shutdown: async () => {},
};

export function createAnalytics(config: AnalyticsConfig, onError: (err: unknown) => void): Analytics {
  if (!config.posthogApiKey) return noopAnalytics;

  // posthog-node batches in the background and, by default, skips GeoIP
  // (the request IP would be this server's anyway).
  const client = new PostHog(config.posthogApiKey, { host: config.posthogHost });
  client.on('error', onError);

  return {
    capture(event, properties = {}) {
      try {
        client.capture({
          distinctId: DISTINCT_ID,
          event,
          properties: { ...properties, $process_person_profile: false },
        });
      } catch (err) {
        onError(err); // analytics must never fail the request that triggered it
      }
    },
    shutdown: () => client.shutdown(SHUTDOWN_TIMEOUT_MS),
  };
}
