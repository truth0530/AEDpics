import { describe, expect, it } from 'vitest';

import { enforceFilterPolicy, FilterEnforcementResult } from '@/lib/aed/filter-policy';
import { ParsedFilters } from '@/lib/utils/query-parser';
import { UserAccessScope } from '@/lib/auth/access-control';
import { UserProfile, UserRole } from '@/packages/types';

function createUserProfile(role: UserRole): UserProfile {
  const now = new Date();
  return {
    id: `${role}-user`,
    email: `${role}@example.com`,
    fullName: `${role} tester`,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

function createAccessScope(overrides: Partial<UserAccessScope>): UserAccessScope {
  return {
    userId: overrides.userId ?? 'user-id',
    allowedRegionCodes: overrides.allowedRegionCodes ?? null,
    allowedCityCodes: overrides.allowedCityCodes ?? null,
    permissions: {
      canViewAllRegions:
        overrides.permissions?.canViewAllRegions ?? (overrides.allowedRegionCodes === null),
      maxResultLimit: overrides.permissions?.maxResultLimit ?? 1000,
      canExportData: overrides.permissions?.canExportData ?? false,
      canViewSensitiveData: overrides.permissions?.canViewSensitiveData ?? false,
      requiresRegionFilter: overrides.permissions?.requiresRegionFilter ?? false,
      requiresCityFilter: overrides.permissions?.requiresCityFilter ?? false,
    },
  };
}

describe('enforceFilterPolicy', () => {
  it('rejects national roles without location or category filters', () => {
    const profile = createUserProfile('master');
    const accessScope = createAccessScope({ allowedRegionCodes: null });
    const filters: ParsedFilters = {};

    const result = enforceFilterPolicy({
      userProfile: profile,
      accessScope,
      requestedFilters: filters,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(400);
      expect(result.reason).toContain('시도/시군구 또는 기관 구분');
    }
  });

  it('allows national roles when category filter is provided', () => {
    const profile = createUserProfile('master');
    const accessScope = createAccessScope({ allowedRegionCodes: null });
    const filters: ParsedFilters = {
      categories: ['구비의무기관'],
    };

    const result = enforceFilterPolicy({
      userProfile: profile,
      accessScope,
      requestedFilters: filters,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.filters.categories).toEqual(['구비의무기관']);
      expect(result.metadata.appliedDefaults).toHaveLength(0);
    }
  });

  it('defaults regional admins to their assigned region when none requested', () => {
    const profile = createUserProfile('regional_admin');
    const accessScope = createAccessScope({
      allowedRegionCodes: ['SEO'],
    });
    const filters: ParsedFilters = {};

    const result = enforceFilterPolicy({
      userProfile: profile,
      accessScope,
      requestedFilters: filters,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.filters.regionCodes).toEqual(['SEO']);
      expect(result.metadata.appliedDefaults).toContain('sido');
    }
  });

  it('rejects filters outside of allowed region scope', () => {
    const profile = createUserProfile('regional_admin');
    const accessScope = createAccessScope({
      allowedRegionCodes: ['SEO'],
    });
    const filters: ParsedFilters = {
      regionCodes: ['BUS'],
    };

    const result = enforceFilterPolicy({
      userProfile: profile,
      accessScope,
      requestedFilters: filters,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(403);
      expect(result.unauthorizedRegions).toEqual(['BUS']);
    }
  });

  it('defaults local admins to their assigned region and city', () => {
    const profile = createUserProfile('local_admin');
    const accessScope = createAccessScope({
      allowedRegionCodes: ['SEO'],
      allowedCityCodes: ['11010'],
    });
    const filters: ParsedFilters = {};

    const result: FilterEnforcementResult = enforceFilterPolicy({
      userProfile: profile,
      accessScope,
      requestedFilters: filters,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.filters.regionCodes).toEqual(['SEO']);
      expect(result.filters.cityCodes).toEqual(['11010']);
      expect(result.metadata.appliedDefaults).toEqual(['sido', 'gugun']);
    }
  });
});
