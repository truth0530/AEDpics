import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadFeatureFlags(overrides: Record<string, string | undefined>) {
  Object.assign(process.env, overrides);
  vi.resetModules();
  return import('@/lib/config/feature-flags');
}

beforeEach(() => {
  Object.assign(process.env, ORIGINAL_ENV);
});

afterEach(() => {
  Object.assign(process.env, ORIGINAL_ENV);
  vi.resetModules();
});

describe('Feature flags configuration', () => {
  it('returns default true when env variables are not set', async () => {
    delete process.env.NEXT_PUBLIC_FEATURE_QUICK_INSPECT;
    delete process.env.NEXT_PUBLIC_FEATURE_SCHEDULE;

    const { isFeatureEnabled } = await loadFeatureFlags({});

    expect(isFeatureEnabled('quickInspect')).toBe(true);
    expect(isFeatureEnabled('schedule')).toBe(true);
  });

  it('parses explicit false values', async () => {
    const { isFeatureEnabled } = await loadFeatureFlags({
      NEXT_PUBLIC_FEATURE_QUICK_INSPECT: 'false',
      NEXT_PUBLIC_FEATURE_SCHEDULE: '0',
    });

    expect(isFeatureEnabled('quickInspect')).toBe(false);
    expect(isFeatureEnabled('schedule')).toBe(false);
  });

  it('ignores malformed values and uses defaults', async () => {
    const { isFeatureEnabled } = await loadFeatureFlags({
      NEXT_PUBLIC_FEATURE_QUICK_INSPECT: 'maybe',
      NEXT_PUBLIC_FEATURE_SCHEDULE: 'enabled',
    });

    expect(isFeatureEnabled('quickInspect')).toBe(true);
    expect(isFeatureEnabled('schedule')).toBe(true);
  });
});
