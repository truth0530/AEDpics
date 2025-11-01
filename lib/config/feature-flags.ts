import { env } from '@/lib/env';

// Note: env.ts already handles boolean transformation for feature flags
// using Zod's transform, so we can use the values directly
export const FEATURE_FLAGS = {
  // Stage 1 - Complete (default: true in production)
  quickInspect: env.NEXT_PUBLIC_FEATURE_QUICK_INSPECT ?? true,
  schedule: env.NEXT_PUBLIC_FEATURE_SCHEDULE ?? true,

  // Stage 2 - In Progress (default: false)
  teamDashboard: env.NEXT_PUBLIC_FEATURE_TEAM_DASHBOARD ?? false,
  realtimeSync: env.NEXT_PUBLIC_FEATURE_REALTIME_SYNC ?? false,
  notifications: env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS ?? false,

  // Stage 3 - Planned (default: false)
  bulkActions: env.NEXT_PUBLIC_FEATURE_BULK_ACTIONS ?? false,
  reports: env.NEXT_PUBLIC_FEATURE_REPORTS ?? false,
  analytics: env.NEXT_PUBLIC_FEATURE_ANALYTICS ?? false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[flag];
}

export function getFeatureFlags() {
  return { ...FEATURE_FLAGS };
}

/**
 * Get all enabled features for debugging
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FEATURE_FLAGS)
    .filter(([, enabled]) => enabled)
    .map(([feature]) => feature);
}

/**
 * Check current development stage
 */
export function getCurrentStage(): number {
  if (FEATURE_FLAGS.teamDashboard || FEATURE_FLAGS.realtimeSync || FEATURE_FLAGS.notifications) {
    return 2;
  }
  if (FEATURE_FLAGS.bulkActions || FEATURE_FLAGS.reports || FEATURE_FLAGS.analytics) {
    return 3;
  }
  return 1;
}
