// Equipment-Centric Access Control Helper
//
// Role-based equipment filtering with address-based and jurisdiction-based access modes
// Used for Phase 2+ API refactoring to implement Equipment-Centric Architecture

import { UserRole } from '@/packages/types';
import {
  normalizeAedDataRegion,
  getNormalizedRegionLabel,
  REGION_LONG_LABELS
} from '@/lib/constants/regions';
import { logger } from '@/lib/logger';

/**
 * Access scope from resolveAccessScope() in access-control.ts
 * Defines the region/city boundaries for a user
 *
 * Note: This interface is for better IDE support and documentation.
 * In practice, use UserAccessScope from access-control.ts which has:
 * - allowedRegionCodes: string[] | null
 * - allowedCityCodes: string[] | null
 * - permissions: RolePermissions
 * - userId: string
 */
export interface AccessScope {
  userRole?: UserRole;
  regionCodes?: string[] | null;      // null = 전국, [] = 접근차단, ['SEO', 'DAE'] = 특정 지역
  cityCodes?: string[] | null;        // null = 전체 시군구, [] = 접근차단, ['종로구', '중구'] = 특정 시군구
  allowedRegionCodes?: string[] | null;  // UserAccessScope field name
  allowedCityCodes?: string[] | null;    // UserAccessScope field name
  jurisdictionCodes?: string[] | null;   // 관할보건소 기준 (선택)
}

/**
 * Equipment filter for Prisma where clause
 * Represents the WHERE condition for equipment queries
 */
export interface EquipmentFilter {
  sido?: string | { in: string[] };
  gugun?: string | { in: string[] };
  jurisdiction_health_center?: string | { in: string[] };
}

/**
 * Build equipment WHERE clause based on role and access scope
 *
 * Rules:
 * - master_admin: 제한 없음 (WHERE 1=1)
 * - regional_admin: 소속 시도만 (WHERE sido IN (...))
 * - local_admin: 소속 시도 AND 시군구 (WHERE sido = ? AND gugun = ?)
 *
 * @param scope AccessScope from resolveAccessScope() (UserAccessScope compatible)
 * @param basis 'address' (sido/gugun) or 'jurisdiction' (jurisdiction_health_center)
 * @returns Prisma-compatible where clause
 */
export function buildEquipmentFilter(
  scope: AccessScope,
  basis: 'address' | 'jurisdiction' = 'address'
): EquipmentFilter {
  // Get region/city codes from either field name (regionCodes or allowedRegionCodes)
  const regionCodes = scope.regionCodes ?? scope.allowedRegionCodes;
  const cityCodes = scope.cityCodes ?? scope.allowedCityCodes;

  // Master admin: no restriction
  if (regionCodes === null) {
    return {};
  }

  // Address-based filtering (sido/gugun)
  if (basis === 'address') {
    return buildAddressBasedFilter({ ...scope, regionCodes, cityCodes });
  }

  // Jurisdiction-based filtering (jurisdiction_health_center)
  if (basis === 'jurisdiction' && scope.jurisdictionCodes) {
    return buildJurisdictionBasedFilter(scope);
  }

  // Fallback: address-based if jurisdiction not available
  return buildAddressBasedFilter({ ...scope, regionCodes, cityCodes });
}

/**
 * Build address-based equipment filter (sido/gugun)
 * Used when filtering by physical installation location
 */
function buildAddressBasedFilter(scope: AccessScope): EquipmentFilter {
  const filter: EquipmentFilter = {};

  // Handle regionCodes
  if (scope.regionCodes && scope.regionCodes.length > 0) {
    // Convert region codes to normalized region names
    const normalizedRegions = scope.regionCodes
      .map(code => getNormalizedRegionLabel(code))
      .filter((name): name is string => name !== null && name !== undefined);

    if (normalizedRegions.length === 1) {
      filter.sido = normalizedRegions[0];
    } else if (normalizedRegions.length > 1) {
      filter.sido = { in: normalizedRegions };
    }
  }

  // Handle cityCodes (시군구)
  if (scope.cityCodes && scope.cityCodes.length > 0) {
    // cityCodes are already normalized (Korean names)
    if (scope.cityCodes.length === 1) {
      filter.gugun = scope.cityCodes[0];
    } else if (scope.cityCodes.length > 1) {
      filter.gugun = { in: scope.cityCodes };
    }
  }

  return filter;
}

/**
 * Build jurisdiction-based equipment filter (jurisdiction_health_center)
 * Used when filtering by managing health center (may be in different region)
 */
function buildJurisdictionBasedFilter(scope: AccessScope): EquipmentFilter {
  const filter: EquipmentFilter = {};

  if (scope.jurisdictionCodes && scope.jurisdictionCodes.length > 0) {
    if (scope.jurisdictionCodes.length === 1) {
      filter.jurisdiction_health_center = scope.jurisdictionCodes[0];
    } else if (scope.jurisdictionCodes.length > 1) {
      filter.jurisdiction_health_center = { in: scope.jurisdictionCodes };
    }
  }

  return filter;
}

/**
 * Check if user can access specific equipment
 *
 * @param equipment AED equipment data with sido, gugun, jurisdiction_health_center
 * @param scope AccessScope from resolveAccessScope()
 * @param basis 'address' or 'jurisdiction'
 * @returns true if accessible, false otherwise
 */
export function canAccessEquipment(
  equipment: {
    equipment_serial: string;
    sido: string | null;
    gugun: string | null;
    jurisdiction_health_center?: string | null;
  },
  scope: AccessScope,
  basis: 'address' | 'jurisdiction' = 'address'
): boolean {
  // Master admin: always accessible
  if (
    scope.userRole === 'master' ||
    scope.userRole === 'emergency_center_admin' ||
    scope.userRole === 'regional_emergency_center_admin' ||
    scope.regionCodes === null
  ) {
    return true;
  }

  // Temporary inspector: only assigned equipment (handled at higher level)
  if (scope.userRole === 'temporary_inspector') {
    return false;
  }

  // Address-based check
  if (basis === 'address') {
    return canAccessByAddress(equipment, scope);
  }

  // Jurisdiction-based check
  if (basis === 'jurisdiction' && scope.jurisdictionCodes) {
    return canAccessByJurisdiction(equipment, scope);
  }

  // Fallback: address-based
  return canAccessByAddress(equipment, scope);
}

/**
 * Check address-based access (sido/gugun matching)
 */
function canAccessByAddress(
  equipment: {
    equipment_serial: string;
    sido: string | null;
    gugun: string | null;
  },
  scope: AccessScope
): boolean {
  // Normalize equipment region
  const equipmentSido = equipment.sido ? normalizeAedDataRegion(equipment.sido) : null;

  // Check region access
  if (scope.regionCodes && scope.regionCodes.length > 0) {
    const allowedRegions = scope.regionCodes
      .map(code => getNormalizedRegionLabel(code))
      .filter((name): name is string => name !== null && name !== undefined);

    if (!equipmentSido || !allowedRegions.includes(equipmentSido)) {
      return false;
    }
  }

  // Check city (gugun) access
  if (scope.cityCodes && scope.cityCodes.length > 0 && equipment.gugun) {
    if (!scope.cityCodes.includes(equipment.gugun)) {
      return false;
    }
  }

  return true;
}

/**
 * Check jurisdiction-based access (jurisdiction_health_center matching)
 */
function canAccessByJurisdiction(
  equipment: {
    equipment_serial: string;
    jurisdiction_health_center?: string | null;
  },
  scope: AccessScope
): boolean {
  if (!scope.jurisdictionCodes || scope.jurisdictionCodes.length === 0) {
    return false;
  }

  const equipmentJurisdiction = equipment.jurisdiction_health_center;
  if (!equipmentJurisdiction) {
    return false;
  }

  return scope.jurisdictionCodes.includes(equipmentJurisdiction);
}

/**
 * Get accessible regions (지역명 list) from access scope
 *
 * @param scope AccessScope
 * @returns List of region names (e.g., ['경기도', '서울특별시']) or null if no restriction
 */
export function getAccessibleRegions(scope: AccessScope): string[] | null {
  // Get region codes from either field name
  const regionCodes = scope.regionCodes ?? scope.allowedRegionCodes;

  // No restriction (master admin or null regionCodes)
  if (regionCodes === null) {
    return null;
  }

  // Empty array: no access
  if (regionCodes.length === 0) {
    return [];
  }

  // Convert region codes to normalized names
  const regions = regionCodes
    .map(code => getNormalizedRegionLabel(code))
    .filter((name): name is string => name !== null && name !== undefined);

  return regions.length > 0 ? regions : [];
}

/**
 * Get accessible cities (시군구명 list) from access scope
 *
 * @param scope AccessScope
 * @returns List of city names (e.g., ['종로구', '중구']) or null if no restriction
 */
export function getAccessibleCities(scope: AccessScope): string[] | null {
  // Get city codes from either field name
  const cityCodes = scope.cityCodes ?? scope.allowedCityCodes;

  // No restriction
  if (cityCodes === null) {
    return null;
  }

  // Empty array: no access
  if (cityCodes.length === 0) {
    return [];
  }

  // cityCodes are already normalized (Korean names)
  return cityCodes;
}

/**
 * Get accessible jurisdictions (관할보건소명 list) from access scope
 *
 * @param scope AccessScope
 * @returns List of jurisdiction names or null if no restriction
 */
export function getAccessibleJurisdictions(scope: AccessScope): string[] | null {
  if (!scope.jurisdictionCodes) {
    return null;
  }

  if (scope.jurisdictionCodes.length === 0) {
    return [];
  }

  return scope.jurisdictionCodes;
}

/**
 * Log equipment access decision (for audit trail)
 */
export function logEquipmentAccess(
  userId: string,
  equipmentSerial: string,
  allowed: boolean,
  scope: AccessScope,
  reason?: string
): void {
  const level = allowed ? 'info' : 'warn';
  const message = allowed ? 'Equipment access granted' : 'Equipment access denied';

  (logger[level] as any)('EquipmentAccess', message, {
    userId,
    equipmentSerial,
    userRole: scope.userRole,
    regionCodes: scope.regionCodes,
    cityCodes: scope.cityCodes,
    reason: reason || 'N/A'
  });
}

/**
 * Validate equipment filter (ensure values are normalized)
 * This is a defensive check to catch data consistency issues early
 */
export function validateEquipmentFilter(filter: EquipmentFilter): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check sido
  if (filter.sido && typeof filter.sido === 'string') {
    const normalized = normalizeAedDataRegion(filter.sido);
    if (normalized !== filter.sido) {
      errors.push(`sido should be normalized: "${filter.sido}" -> "${normalized}"`);
    }
  }

  // Check sido array
  if (filter.sido && typeof filter.sido === 'object' && 'in' in filter.sido) {
    const sidoArray = (filter.sido as { in: string[] }).in;
    sidoArray.forEach(sid => {
      const normalized = normalizeAedDataRegion(sid);
      if (normalized !== sid) {
        errors.push(`sido in array should be normalized: "${sid}" -> "${normalized}"`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
