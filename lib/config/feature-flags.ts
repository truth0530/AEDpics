const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSY_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (TRUTHY_VALUES.has(normalized)) {
    return true;
  }
  if (FALSY_VALUES.has(normalized)) {
    return false;
  }
  return defaultValue;
}

export const FEATURE_FLAGS = {
  // Stage 1 - Complete (default: true in production)
  quickInspect: parseFlag(process.env.NEXT_PUBLIC_FEATURE_QUICK_INSPECT, true),
  schedule: parseFlag(process.env.NEXT_PUBLIC_FEATURE_SCHEDULE, true),

  // Stage 2 - In Progress (default: false)
  teamDashboard: parseFlag(process.env.NEXT_PUBLIC_FEATURE_TEAM_DASHBOARD, false),
  realtimeSync: parseFlag(process.env.NEXT_PUBLIC_FEATURE_REALTIME_SYNC, false),
  notifications: parseFlag(process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS, false),

  // Stage 3 - Planned (default: false)
  bulkActions: parseFlag(process.env.NEXT_PUBLIC_FEATURE_BULK_ACTIONS, false),
  reports: parseFlag(process.env.NEXT_PUBLIC_FEATURE_REPORTS, false),
  analytics: parseFlag(process.env.NEXT_PUBLIC_FEATURE_ANALYTICS, false),
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
