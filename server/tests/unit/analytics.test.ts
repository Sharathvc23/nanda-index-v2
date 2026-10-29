import { describe, it, expect, beforeEach, vi } from 'vitest';

const client = vi.hoisted(() => ({
  constructed: [] as Array<{ apiKey: string; options: Record<string, unknown> }>,
  capture: vi.fn(),
  shutdown: vi.fn(async () => {}),
  on: vi.fn(),
}));

vi.mock('posthog-node', () => ({
  PostHog: class {
    constructor(apiKey: string, options: Record<string, unknown>) {
      client.constructed.push({ apiKey, options });
    }
    capture = client.capture;
    shutdown = client.shutdown;
    on = client.on;
  },
}));

const { createAnalytics } = await import('../../src/services/analytics.js');

const CONFIG = { posthogApiKey: 'phc_test', posthogHost: 'https://eu.i.posthog.com' };

beforeEach(() => {
  client.constructed.length = 0;
  vi.clearAllMocks();
});

describe('createAnalytics', () => {
  it('is a no-op without an API key and never creates a client', async () => {
    const analytics = createAnalytics({ ...CONFIG, posthogApiKey: undefined }, vi.fn());

    analytics.capture('entry_registered', { hosting_path: 'registry' });
    await analytics.shutdown();

    expect(client.constructed).toHaveLength(0);
    expect(client.capture).not.toHaveBeenCalled();
  });

  it('creates a client for the configured project and host', () => {
    createAnalytics(CONFIG, vi.fn());

    expect(client.constructed).toEqual([
      { apiKey: 'phc_test', options: expect.objectContaining({ host: 'https://eu.i.posthog.com' }) },
    ]);
  });

  it('sends personless events under one shared distinct id', () => {
    const analytics = createAnalytics(CONFIG, vi.fn());

    analytics.capture('entry_registered', { hosting_path: 'registry', has_domain: true });
    analytics.capture('account_verified');

    expect(client.capture).toHaveBeenNthCalledWith(1, {
      distinctId: 'nanda-index-api',
      event: 'entry_registered',
      properties: { hosting_path: 'registry', has_domain: true, $process_person_profile: false },
    });
    expect(client.capture).toHaveBeenNthCalledWith(2, {
      distinctId: 'nanda-index-api',
      event: 'account_verified',
      properties: { $process_person_profile: false },
    });
  });

  it('reports a failing capture instead of throwing into the request', () => {
    const onError = vi.fn();
    const failure = new Error('queue full');
    client.capture.mockImplementationOnce(() => {
      throw failure;
    });
    const analytics = createAnalytics(CONFIG, onError);

    expect(() => analytics.capture('entry_deleted')).not.toThrow();
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('reports delivery errors the client emits later', () => {
    const onError = vi.fn();
    createAnalytics(CONFIG, onError);

    expect(client.on).toHaveBeenCalledWith('error', onError);
  });

  it('flushes queued events on shutdown, with a bounded wait', async () => {
    const analytics = createAnalytics(CONFIG, vi.fn());

    await analytics.shutdown();

    expect(client.shutdown).toHaveBeenCalledWith(expect.any(Number));
  });
});
