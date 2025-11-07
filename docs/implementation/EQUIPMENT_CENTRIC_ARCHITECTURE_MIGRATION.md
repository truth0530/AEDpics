# Equipment-Centric Architecture Migration Implementation Plan

**Document Version**: 1.0
**Created**: 2025-11-07
**Status**: Ready for Phase 0 Execution
**Last Updated**: 2025-11-07

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement and Solution](#problem-statement-and-solution)
3. [Architecture Overview](#architecture-overview)
4. [6-Phase Implementation Roadmap](#6-phase-implementation-roadmap)
5. [Technical Specifications](#technical-specifications)
6. [Data Validation Strategy](#data-validation-strategy)
7. [Risk Management](#risk-management)
8. [Rollback Procedures](#rollback-procedures)
9. [Success Criteria](#success-criteria)
10. [Key Decisions and Rationale](#key-decisions-and-rationale)

---

## Executive Summary

### Problem

The AED scheduling and inspection management system suffers from a critical data visibility bug: equipment added by the master account is not visible to organization-level accounts. The root cause is a **fundamental architectural flaw** in the data filtering logic.

**Current Architecture (User-Centric)**:
- Equipment schedules filtered by `created_by = current_user.id`
- Equipment assignments filtered by `assigned_to = current_user.id`
- No relationship between schedules/assignments and organizations
- Master account cannot share equipment with subordinate organizations

**Result**: Equipment operates in isolated silos rather than as shared organizational assets.

### Solution

Migrate to an **Equipment-Centric Architecture** where all data visibility is determined by:
- Equipment metadata (`aed_data.sido`, `aed_data.gugun`, `aed_data.jurisdiction_health_center`)
- User's access scope (region and city restrictions)
- User's role (master, regional_admin, local_admin)

**Core Principle**: "Who did it doesn't matter. What equipment matters." - Equipment is the single source of truth.

### Expected Outcomes

1. Master account can share equipment with all organizations
2. Regional administrators see all equipment in their region
3. Local administrators see equipment in their jurisdiction (both by address and by health center)
4. All role-based access control aligned with existing `resolveAccessScope()` function
5. No data silos; equipment visibility consistent across all users with appropriate access
6. Audit trail preserved (user tracking via `created_by`, `assigned_to` maintained for compliance)

### Implementation Timeline

- **Phase 0** (1-2 days): Data validation and migration readiness assessment
- **Phase 1** (1 day): Database schema migration (FK additions)
- **Phase 2** (2-3 days): API layer refactoring with equipment-based access control
- **Phase 3** (1 day): Cache optimization and performance tuning
- **Phase 4** (2-3 days): UI updates for equipment-centric interface
- **Phase 5** (2-3 days): Comprehensive integration testing and validation

**Total Estimated Duration**: 1.5-2 weeks

---

## Problem Statement and Solution

### Root Cause Analysis

#### Original Issue
- Master account adds equipment to schedule
- Local admin account logs in
- Equipment is not visible in the equipment list or schedules

#### Investigation Process
1. Examined `/aed-data` page component and API endpoint
2. Traced `inspection_schedules` filtering logic
3. Found: `where: { created_by: session.user.id }`
4. Found same issue in `inspection_assignments`: `where: { assigned_to: session.user.id }`

#### Core Problem
The schema design conflates **who performed an action** with **what equipment can be accessed**.

Example:
```typescript
// Current (broken) logic
const schedules = await prisma.inspection_schedule_entries.findMany({
  where: { created_by: session.user.id }  // Only shows schedules THIS user created
});

// Problem: Master creates schedule, Local Admin cannot see it
// Problem: Each user sees only their own records
// Problem: No organizational data sharing
```

#### Why It Fails
1. **User-Centric Model**: Data filtered by `user.id`
2. **No Organization Relationship**: Schedules have no `organization_id` field
3. **No Equipment Relationship**: Schedules tied to users, not to equipment
4. **Access Scope Mismatch**: User's `allowedRegionCodes` and `allowedCityCodes` are never used for filtering

### Proposed Solution: Equipment-Centric Architecture

#### Core Concept
All data visibility determined by **equipment metadata**, not by **who created the record**.

```typescript
// Proposed (correct) logic
const accessScope = resolveAccessScope(userProfile);  // Get user's allowed regions/cities

const schedules = await prisma.inspection_schedule_entries.findMany({
  where: {
    aed_data: {  // Filter by equipment's location
      sido: { in: accessScope.allowedRegionCodes }
    }
  },
  include: { aed_data: true }
});

// Result: User sees all equipment they have access to, regardless of who created it
```

#### Key Principles

1. **Single Source of Truth**: Equipment metadata (`aed_data`)
2. **Access Scope Integration**: Use existing `resolveAccessScope()` return values
3. **Jurisdiction Support**: Health center jurisdiction filtering via `aed_data.jurisdiction_health_center`
4. **Audit Trail Preservation**: Keep `created_by`, `assigned_to` for compliance
5. **No Duplication**: Don't create `organization_id` column (would duplicate `jurisdiction_health_center`)

#### Why This Works

The existing `resolveAccessScope()` function already returns:
```typescript
{
  allowedRegionCodes: ["대구광역시", "부산광역시"],  // Korean names
  allowedCityCodes: ["중구", "남구"],                // Korean names
  // ... other fields
}
```

And `aed_data` already has:
```typescript
{
  equipment_serial: "A-001",
  sido: "대구광역시",  // Matches allowedRegionCodes format
  gugun: "중구",      // Matches allowedCityCodes format
  jurisdiction_health_center: "대구중구보건소"
}
```

**Perfect alignment** - No new schema columns needed, just strengthen the relationships.

---

## Architecture Overview

### Current Schema Relationships

```
inspection_schedules
├── equipment_serial (string)
├── aed_data_id (FK to aed_data) ✅ ALREADY EXISTS
├── created_by (user_id, audit only)
└── assigned_to (user_id, audit only)

inspection_schedule_entries  (detail entries within a schedule)
├── device_equipment_serial (string)
├── aed_data_id (FK) ❌ MISSING - will be added in Phase 1
├── created_by (audit only)
└── ...

inspection_assignments
├── equipment_serial (string)
├── aed_data_id (FK) ❌ MISSING - will be added in Phase 1
├── assigned_to (user_id, audit only)
└── ...

inspections (completed inspections)
├── equipment_serial (string)
├── aed_data_id (FK) ✅ ALREADY EXISTS
└── ...

aed_data (master equipment list)
├── equipment_serial (PK)
├── sido (string, e.g., "대구광역시")
├── gugun (string, e.g., "중구")
├── jurisdiction_health_center (string, e.g., "대구중구보건소")
└── ... other equipment metadata
```

### Data Flow After Migration

```
User Request
    ↓
[Authentication Layer]
    ↓
[resolveAccessScope()] → { allowedRegionCodes: [...], allowedCityCodes: [...] }
    ↓
[buildEquipmentAccessFilter()] → Prisma WHERE clause using aed_data
    ↓
[Database Query] → JOIN aed_data to filter by region/city
    ↓
[Post-Filter] → Apply jurisdiction normalization (jurisdiction_health_center match)
    ↓
[Return Data] → Equipment visible to user based on their access scope
```

### Access Control Rules After Migration

| Role | Access Method | Equipment Visible | Notes |
|------|---------------|-------------------|-------|
| Master | None (all equipment) | National (81,464) | `allowedRegionCodes = null` → all records |
| Regional Admin | Region-based | Region's equipment | Must have `allowedRegionCodes` |
| Local Admin | Jurisdiction OR Address | City's equipment | Jurisdiction uses `jurisdiction_health_center` matching; Address uses `sido + gugun` |

---

## 6-Phase Implementation Roadmap

### Phase 0: Data Validation and Migration Readiness (Days 1-2)

**Objective**: Verify all data is compatible with FK constraints before schema migration.

**Deliverables**:
1. `migration-readiness-report.json` - Validation results
2. Data cleanup scripts if issues found
3. Go/No-Go decision for Phase 1

**Key Validations**:

1. **Null Equipment Serial Check**
   - Table: `inspection_schedule_entries`, `inspection_assignments`
   - Query: Count records where `equipment_serial IS NULL` or `device_equipment_serial IS NULL`
   - Pass Criteria: 0 records with null values
   - Remediation: Mark schedules as "orphaned" and set created_by as owner

2. **Orphan Records Check**
   - Query: Join with `aed_data` and check for records with no matching equipment
   - Pass Criteria: 0 orphan records
   - Remediation: Delete orphan records or create placeholder equipment entries

3. **Equipment Serial Compatibility**
   - Check: Length ≤ 255 characters (PostgreSQL VARCHAR constraint)
   - Check: No invalid characters (control characters, null bytes)
   - Pass Criteria: All valid
   - Remediation: Trim/sanitize serialization if needed

4. **Organization Name Normalization Test**
   - Create test cases: "대구 중구 보건소" vs "대구중구보건소"
   - Verify `normalizeOrganizationName()` function works correctly
   - Pass Criteria: All test cases pass

5. **Region Code Mapping Test**
   - Verify `normalizeRegionCode()` handles all 17 regions
   - Test: "DAE" → "대구광역시", "대구" → "대구광역시"
   - Pass Criteria: All mappings correct

6. **Index Review**
   - Current indexes on `created_by`, `assigned_to`
   - Plan: Add indexes on `equipment_serial` and `aed_data_id`
   - Document: Index creation strategy

**Phase 0 Script Location**: `scripts/data-validation/check-equipment-fk-readiness.ts`

**Success Criteria**:
- All 6 validations pass
- No data cleanup required OR all cleanup successful
- Go decision made by project stakeholder

---

### Phase 1: Database Schema Migration (Day 3)

**Objective**: Add FK constraints to strengthen relationships between inspection tables and equipment.

**Deliverables**:
1. Prisma migration: `add_equipment_fk_to_inspections`
2. New indexes on equipment-based queries
3. Database integrity verification

**Schema Changes**:

#### 1.1 Update `inspection_schedule_entries` Model
**File**: `prisma/schema.prisma` (lines 188-204)

**Current**:
```prisma
model inspection_schedule_entries {
  // ... fields
  device_equipment_serial String?
  created_by String
  // No FK to aed_data
}
```

**After**:
```prisma
model inspection_schedule_entries {
  // ... fields
  device_equipment_serial String
  aed_data_id Int?  // FK to aed_data
  aed_data AedData? @relation("schedule_entries_aed", fields: [aed_data_id], references: [id])
  created_by String
  created_by_user UserProfile? @relation(fields: [created_by], references: [id])

  @@index([aed_data_id])
  @@index([created_by])
  @@index([device_equipment_serial])
}
```

#### 1.2 Update `inspection_assignments` Model
**File**: `prisma/schema.prisma` (lines 163-186)

**Current**:
```prisma
model inspection_assignments {
  // ... fields
  equipment_serial String?
  assigned_to String
  // No FK to aed_data
}
```

**After**:
```prisma
model inspection_assignments {
  // ... fields
  equipment_serial String
  aed_data_id Int?  // FK to aed_data
  aed_data AedData? @relation("assignments_aed", fields: [aed_data_id], references: [id])
  assigned_to String
  assigned_to_user UserProfile? @relation(fields: [assigned_to], references: [id])

  @@index([aed_data_id])
  @@index([assigned_to])
  @@index([equipment_serial])
}
```

#### 1.3 Update `aed_data` Model (Reverse Relationships)
**File**: `prisma/schema.prisma`

**Add**:
```prisma
model aed_data {
  // ... existing fields

  // Add reverse relationships
  schedule_entries inspection_schedule_entries[] @relation("schedule_entries_aed")
  assignments inspection_assignments[] @relation("assignments_aed")
  inspections inspections[] @relation("inspections_aed")  // May already exist
}
```

#### 1.4 Migration Steps
```bash
# Step 1: Create migration file
cd /var/www/aedpics
npx prisma migrate dev --name add_equipment_fk_to_inspections --create-only

# Step 2: Review generated migration
cat prisma/migrations/[timestamp]_add_equipment_fk_to_inspections/migration.sql

# Step 3: Apply migration
npx prisma migrate deploy

# Step 4: Verify schema
npx prisma studio  # Visually confirm changes

# Step 5: Regenerate Prisma client
npx prisma generate
```

**Success Criteria**:
- Migration applies without errors
- All FK constraints active
- `prisma generate` completes successfully
- No application-level type errors

---

### Phase 2: API Layer Refactoring - Equipment-Based Access Control (Days 4-6)

**Objective**: Implement equipment-based access filtering in API endpoints.

**Deliverables**:
1. `lib/auth/equipment-access.ts` - Core access control functions
2. `lib/utils/organization-normalization.ts` - String normalization utilities
3. Updated API endpoints with equipment filtering
4. Logging for access decision auditing

#### 2.1 Create Normalization Utilities

**File**: `lib/utils/organization-normalization.ts` (NEW)

```typescript
/**
 * Normalize organization names for comparison
 * Handles spaces, parentheses, special characters
 */
export function normalizeOrganizationName(name: string | undefined): string {
  if (!name) return '';
  return name
    .replace(/\s+/g, '')              // Remove spaces
    .replace(/\(.*?\)/g, '')           // Remove parentheses content
    .replace(/[·•]/g, '')              // Remove special separators
    .toLowerCase()
    .trim();
}

/**
 * Compare two organization names ignoring formatting
 */
export function compareOrganizationNames(
  name1: string | undefined,
  name2: string | undefined
): boolean {
  const norm1 = normalizeOrganizationName(name1);
  const norm2 = normalizeOrganizationName(name2);
  return norm1 === norm2 && norm1.length > 0;
}

/**
 * Region code normalization
 * Maps: "DAE" → "대구광역시", "대구" → "대구광역시"
 */
const REGION_CODE_MAP: Record<string, string> = {
  // Seoul
  '서울특별시': '서울특별시',
  '서울': '서울특별시',
  'SEOUL': '서울특별시',
  'SEL': '서울특별시',

  // Busan
  '부산광역시': '부산광역시',
  '부산': '부산광역시',
  'BUSAN': '부산광역시',
  'BSN': '부산광역시',

  // Daegu
  '대구광역시': '대구광역시',
  '대구': '대구광역시',
  'DAEGU': '대구광역시',
  'DAE': '대구광역시',

  // ... all 17 regions
};

export function normalizeRegionCode(code: string | undefined): string {
  if (!code) return '';
  return REGION_CODE_MAP[code] || code;
}

/**
 * Compare region codes across formats
 */
export function compareRegionCodes(
  code1: string | undefined,
  code2: string | undefined
): boolean {
  const norm1 = normalizeRegionCode(code1);
  const norm2 = normalizeRegionCode(code2);
  return norm1 === norm2 && norm1.length > 0;
}
```

#### 2.2 Create Equipment Access Control

**File**: `lib/auth/equipment-access.ts` (NEW)

```typescript
/**
 * Equipment-based access control
 * Single source of truth for equipment visibility
 */

import { UserProfile, UserAccessScope } from '@/packages/types';
import {
  compareOrganizationNames,
  compareRegionCodes,
  normalizeOrganizationName,
  normalizeRegionCode
} from '@/lib/utils/organization-normalization';

export interface EquipmentAccessCheck {
  canAccess: boolean;
  reason?: string;
  matchedCriteria?: 'jurisdiction' | 'address' | 'region' | 'master';
}

export interface EquipmentMetadata {
  equipment_serial: string;
  jurisdiction_health_center?: string | null;
  sido: string;
  gugun: string;
}

/**
 * Server-side validation: Check if user can access specific equipment
 * This is the authoritative check; client-side checks are UI convenience only
 */
export async function canAccessEquipment(
  userProfile: UserProfile,
  aedDevice: EquipmentMetadata,
  accessScope: UserAccessScope
): Promise<EquipmentAccessCheck> {

  // Master role: unrestricted national access
  if (userProfile.role === 'master') {
    return {
      canAccess: true,
      matchedCriteria: 'master'
    };
  }

  // Regional administrator: region-based filtering
  if (userProfile.role === 'regional_admin') {
    if (!accessScope.allowedRegionCodes?.length) {
      return {
        canAccess: false,
        reason: 'Regional admin has no allowed regions'
      };
    }

    for (const allowedRegion of accessScope.allowedRegionCodes) {
      if (compareRegionCodes(allowedRegion, aedDevice.sido)) {
        return {
          canAccess: true,
          matchedCriteria: 'region'
        };
      }
    }

    return {
      canAccess: false,
      reason: `Equipment region (${aedDevice.sido}) outside allowed regions`
    };
  }

  // Local administrator: jurisdiction OR address-based
  if (userProfile.role === 'local_admin') {
    // Check 1: Jurisdiction-based access
    if (aedDevice.jurisdiction_health_center && userProfile.organization?.name) {
      if (compareOrganizationNames(
        aedDevice.jurisdiction_health_center,
        userProfile.organization.name
      )) {
        return {
          canAccess: true,
          matchedCriteria: 'jurisdiction',
          reason: 'Matched by jurisdiction health center'
        };
      }
    }

    // Check 2: Address-based access
    if (!accessScope.allowedCityCodes?.length) {
      return {
        canAccess: false,
        reason: 'Local admin has no allowed cities'
      };
    }

    // Must be in both allowed region AND allowed city
    const regionMatch = accessScope.allowedRegionCodes?.some(r =>
      compareRegionCodes(r, aedDevice.sido)
    );

    const cityMatch = accessScope.allowedCityCodes.includes(aedDevice.gugun);

    if (regionMatch && cityMatch) {
      return {
        canAccess: true,
        matchedCriteria: 'address',
        reason: `Matched by address: ${aedDevice.sido} ${aedDevice.gugun}`
      };
    }

    return {
      canAccess: false,
      reason: `Equipment address (${aedDevice.sido} ${aedDevice.gugun}) outside allowed area`
    };
  }

  return {
    canAccess: false,
    reason: 'Role not allowed access'
  };
}

/**
 * Build Prisma WHERE filter for equipment-based access
 * Used in findMany queries to pre-filter at DB level
 * Note: Jurisdiction matching done in post-filter due to Prisma string normalization limitation
 */
export function buildEquipmentAccessFilter(
  userProfile: UserProfile,
  accessScope: UserAccessScope
) {
  // Master: No filter (all records)
  if (userProfile.role === 'master') {
    return {};
  }

  // Regional admin: Filter by region
  if (userProfile.role === 'regional_admin') {
    return {
      aed_data: {
        sido: { in: accessScope.allowedRegionCodes || [] }
      }
    };
  }

  // Local admin: Filter by region + city, plus allow jurisdiction matches
  if (userProfile.role === 'local_admin') {
    return {
      aed_data: {
        OR: [
          // Address-based filter: must match both region and city
          {
            AND: [
              { sido: { in: accessScope.allowedRegionCodes || [] } },
              { gugun: { in: accessScope.allowedCityCodes || [] } }
            ]
          },
          // Jurisdiction-based filter: relaxed at DB level, validated in post-filter
          { jurisdiction_health_center: { not: null } }
        ]
      }
    };
  }

  // Viewer or unknown role: No access
  return {
    aed_data: { equipment_serial: { in: [] } }
  };
}

/**
 * Post-filter for jurisdiction-based access
 * Applied AFTER database query because Prisma WHERE cannot normalize strings
 * Filters records to only those where jurisdiction matches user's organization
 */
export function postFilterJurisdictionAccess(
  records: Array<{
    aed_data?: {
      jurisdiction_health_center?: string | null
    }
  }>,
  organizationName: string | undefined
): typeof records {
  if (!organizationName) {
    // If user has no organization, pass through all records
    // (they were already filtered by address-based access)
    return records;
  }

  return records.filter(record => {
    const jurisdictionName = record.aed_data?.jurisdiction_health_center;

    // If no jurisdiction specified, keep record (address-based access)
    if (!jurisdictionName) return true;

    // Check if jurisdiction matches user's organization
    return compareOrganizationNames(jurisdictionName, organizationName);
  });
}

/**
 * Build response metadata for client
 * Tells UI what access level user has
 */
export function getAccessLevelInfo(
  userProfile: UserProfile,
  accessScope: UserAccessScope
) {
  if (userProfile.role === 'master') {
    return {
      accessLevel: 'national',
      regionCount: 17,
      description: '전국 모든 AED 조회 가능'
    };
  }

  if (userProfile.role === 'regional_admin') {
    const regionCount = accessScope.allowedRegionCodes?.length || 0;
    return {
      accessLevel: 'regional',
      regionCount,
      regions: accessScope.allowedRegionCodes,
      description: `${regionCount}개 시도 조회 가능`
    };
  }

  if (userProfile.role === 'local_admin') {
    const cityCount = accessScope.allowedCityCodes?.length || 0;
    return {
      accessLevel: 'local',
      region: accessScope.allowedRegionCodes?.[0],
      cityCount,
      cities: accessScope.allowedCityCodes,
      organization: userProfile.organization?.name,
      description: `${userProfile.organization?.name} 관할 AED 조회 가능`
    };
  }

  return {
    accessLevel: 'none',
    description: '접근 권한 없음'
  };
}
```

#### 2.3 Update API Endpoints

**File**: `app/api/inspection-schedules/route.ts` (MODIFIED)

Key changes:
- Remove: `where: { created_by: session.user.id }`
- Add: Equipment-based filtering using `buildEquipmentAccessFilter()`
- Add: Post-filter for jurisdiction matching
- Add: Logging for access decisions

```typescript
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userProfile = mapUserProfile(session.user);
  const accessScope = resolveAccessScope(userProfile);
  const equipmentAccessFilter = buildEquipmentAccessFilter(userProfile, accessScope);

  const schedules = await prisma.inspection_schedule_entries.findMany({
    where: equipmentAccessFilter,  // Equipment-based filter
    include: {
      aed_data: {
        select: {
          equipment_serial: true,
          sido: true,
          gugun: true,
          jurisdiction_health_center: true
        }
      }
    },
    orderBy: { scheduled_for: 'asc' }
  });

  // Post-filter: Jurisdiction matching with normalization
  const filtered = postFilterJurisdictionAccess(
    schedules,
    userProfile.organization?.name
  );

  // Log access
  console.log(`User ${session.user.id} accessed ${filtered.length} inspection schedules`);

  return NextResponse.json({ data: filtered });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const userProfile = mapUserProfile(session.user);
  const accessScope = resolveAccessScope(userProfile);

  // Get equipment metadata
  const aedDevice = await prisma.aed_data.findUnique({
    where: { equipment_serial: body.equipment_serial },
    select: {
      id: true,
      equipment_serial: true,
      jurisdiction_health_center: true,
      sido: true,
      gugun: true
    }
  });

  if (!aedDevice) {
    return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
  }

  // Authoritative access check (server-side)
  const accessCheck = await canAccessEquipment(userProfile, aedDevice, accessScope);
  if (!accessCheck.canAccess) {
    console.warn(
      `Access denied for user ${session.user.id} to equipment ${aedDevice.equipment_serial}: ${accessCheck.reason}`
    );
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Create schedule
  const schedule = await prisma.inspection_schedule_entries.create({
    data: {
      device_equipment_serial: body.equipment_serial,
      aed_data_id: aedDevice.id,  // Now set via FK
      scheduled_for: new Date(body.scheduled_for),
      created_by: session.user.id,
      assignee_identifier: body.assignee_identifier,
      notes: body.notes
    }
  });

  console.log(
    `User ${session.user.id} created schedule for equipment ${aedDevice.equipment_serial}`
  );

  return NextResponse.json({ data: schedule }, { status: 201 });
}
```

**Similar Updates Required**:
- `app/api/inspection-assignments/route.ts`
- `app/api/aed-data/route.ts` (modify `includeSchedule` filter)
- `app/api/equipment/accessible/route.ts` (NEW - return user's accessible equipment)

#### 2.4 New Endpoint: Equipment Accessibility Check

**File**: `app/api/equipment/accessible/route.ts` (NEW)

```typescript
/**
 * Return only equipment accessible to current user
 * Used by UI to populate equipment selection dropdowns
 * Server-side filtering mandatory; client uses result directly
 */

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userProfile = mapUserProfile(session.user);
  const accessScope = resolveAccessScope(userProfile);
  const equipmentAccessFilter = buildEquipmentAccessFilter(userProfile, accessScope);
  const accessLevelInfo = getAccessLevelInfo(userProfile, accessScope);

  // Master: all equipment
  if (userProfile.role === 'master') {
    const devices = await prisma.aed_data.findMany({
      select: {
        id: true,
        equipment_serial: true,
        sido: true,
        gugun: true
      },
      orderBy: { equipment_serial: 'asc' }
    });

    return NextResponse.json({
      data: devices,
      accessLevel: accessLevelInfo.accessLevel,
      count: devices.length
    });
  }

  // Regional/Local: Apply filter
  const devices = await prisma.aed_data.findMany({
    where: equipmentAccessFilter,
    select: {
      id: true,
      equipment_serial: true,
      sido: true,
      gugun: true,
      jurisdiction_health_center: true
    },
    orderBy: { equipment_serial: 'asc' }
  });

  // Post-filter for jurisdiction
  const filtered = postFilterJurisdictionAccess(devices, userProfile.organization?.name);

  return NextResponse.json({
    data: filtered,
    accessLevel: accessLevelInfo.accessLevel,
    count: filtered.length
  });
}
```

**Phase 2 Success Criteria**:
- All 5 API endpoints updated
- Equipment-based filtering applied
- Jurisdiction post-filtering working
- No type errors after `npm run tsc`
- Lint passes: `npm run lint`
- No breaking changes to client code

---

### Phase 3: Cache and Performance Optimization (Day 7)

**Objective**: Optimize access scope lookups and equipment query performance.

**Deliverables**:
1. `lib/cache/access-scope-cache.ts` - Access scope caching
2. Equipment query indexes verified
3. Performance monitoring setup

#### 3.1 Access Scope Caching

**File**: `lib/cache/access-scope-cache.ts` (NEW)

```typescript
/**
 * Cache access scope computations
 * TTL: 1 hour (balances freshness vs DB load)
 */

import { cache as redisCache } from 'react';  // Next.js request cache
import { UserAccessScope } from '@/packages/types';

const CACHE_TTL = 3600;  // 1 hour

export async function getCachedAccessScope(
  userId: string,
  role: string
): Promise<UserAccessScope | null> {
  // Cache key structure: access-scope:${userId}:${role}
  // NOT scope.userId to avoid key duplication
  const cacheKey = `access-scope:${userId}:${role}`;

  try {
    const cached = await redis.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error(`Cache read error for ${cacheKey}:`, error);
    return null;  // Graceful degradation: recompute if cache fails
  }
}

export async function setCachedAccessScope(
  userId: string,
  role: string,
  scope: UserAccessScope
): Promise<void> {
  const cacheKey = `access-scope:${userId}:${role}`;

  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(scope));
  } catch (error) {
    console.error(`Cache write error for ${cacheKey}:`, error);
    // Non-blocking: cache failure doesn't break application
  }
}

export async function invalidateAccessScopeCache(
  userId: string,
  role?: string
): Promise<void> {
  // Invalidate specific role or all roles for user
  if (role) {
    const cacheKey = `access-scope:${userId}:${role}`;
    await redis.del(cacheKey);
  } else {
    // Invalidate all access scopes for user
    const pattern = `access-scope:${userId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

export async function resolveAccessScopeWithCache(
  userProfile: UserProfile
): Promise<UserAccessScope> {
  // Try cache first
  const cached = await getCachedAccessScope(userProfile.id, userProfile.role);
  if (cached) {
    return cached;
  }

  // Compute and cache
  const scope = resolveAccessScope(userProfile);
  await setCachedAccessScope(userProfile.id, userProfile.role, scope);

  return scope;
}
```

#### 3.2 Index Strategy

**Current Indexes** (to retain):
- `inspection_schedule_entries(created_by)` - For audit trail
- `inspection_assignments(assigned_to)` - For "my tasks" feature

**New Indexes** (to add in Phase 1):
- `inspection_schedule_entries(aed_data_id)` - For equipment-based queries
- `inspection_schedule_entries(device_equipment_serial)` - For serial-based lookups
- `inspection_assignments(aed_data_id)` - For equipment-based queries
- `aed_data(sido, gugun)` - For region/city lookups

**Composite Index Strategy**:
```sql
-- For local admin queries filtering by region + city + jurisdiction
CREATE INDEX idx_aed_data_region_city_jurisdiction
ON aed_data(sido, gugun, jurisdiction_health_center);
```

#### 3.3 Query Performance Monitoring

Add to API endpoints:
```typescript
const startTime = performance.now();

const schedules = await prisma.inspection_schedule_entries.findMany({
  where: equipmentAccessFilter,
  include: { aed_data: true }
});

const duration = performance.now() - startTime;
console.log(`Equipment query took ${duration.toFixed(2)}ms, returned ${schedules.length} records`);

// Alert if query slow
if (duration > 1000) {
  console.warn(`SLOW QUERY: Equipment filter took ${duration.toFixed(2)}ms`);
}
```

**Phase 3 Success Criteria**:
- Cache implementation tested
- Index creation verified
- Query performance logged
- No performance regression

---

### Phase 4: UI Update - Equipment-Centric Interface (Days 8-9)

**Objective**: Update UI components to reflect equipment-centric data model.

**Key Changes**:

1. **Equipment Selection Component** (NEW)
   - Load accessible equipment from `/api/equipment/accessible`
   - Display region/city information
   - Show access level indicator

2. **Schedule List View** (UPDATE)
   - Sort by equipment_serial instead of created_by
   - Remove creator information
   - Show equipment location (region, city)
   - Show jurisdiction if applicable

3. **Assignment View** (UPDATE)
   - Equipment-centric sorting
   - Access level indicators
   - Remove assignee-only filters

4. **Map View** (UPDATE)
   - All accessible equipment visible
   - Color-code by region for regional admins
   - Mark jurisdiction vs address matches differently

#### 4.1 Example Component Updates

```typescript
// Before (User-Centric)
const schedules = response.data.filter(s => s.created_by === currentUserId);

// After (Equipment-Centric)
const schedules = response.data;  // Already filtered by server
// Display equipment information
<div>{schedule.aed_data.equipment_serial}</div>
<div>{schedule.aed_data.sido} {schedule.aed_data.gugun}</div>
```

**Phase 4 Success Criteria**:
- All UI components updated
- Equipment selection works end-to-end
- Schedule list displays correctly
- Map view shows all accessible equipment
- No breaking changes to user workflows

---

### Phase 5: Integration Testing and Validation (Days 10-12)

**Objective**: Comprehensive testing across all roles and scenarios.

**Test Categories**:

#### 5.1 Unit Tests

**File**: `__tests__/lib/organization-normalization.test.ts`

```typescript
describe('Organization Normalization', () => {
  it('should match organizations with space differences', () => {
    expect(compareOrganizationNames('대구 중구 보건소', '대구중구보건소')).toBe(true);
  });

  it('should handle parentheses variations', () => {
    expect(normalizeOrganizationName('대구중구보건소(중구청)')).toBe('대구중구보건소');
  });

  it('should handle case insensitivity', () => {
    expect(compareOrganizationNames('대구중구보건소', '대구중구보건소')).toBe(true);
  });

  it('should match region codes across formats', () => {
    expect(compareRegionCodes('대구광역시', '대구')).toBe(true);
    expect(compareRegionCodes('DAE', '대구광역시')).toBe(true);
    expect(compareRegionCodes('DAEGU', '대구')).toBe(true);
  });

  it('should reject invalid comparisons', () => {
    expect(compareOrganizationNames('서울', '대구')).toBe(false);
    expect(compareRegionCodes('서울', '대구')).toBe(false);
  });
});
```

#### 5.2 Integration Tests

**Test Scenarios**:

**Master Account**:
- [ ] Can see all 81,464 AED records
- [ ] Can create schedule for any equipment
- [ ] Can assign to any user
- [ ] No region restrictions

**Regional Admin (대구)**:
- [ ] Sees only equipment in 대구광역시 (unless jurisdiction match)
- [ ] Cannot see equipment in other regions
- [ ] Can create schedule for accessible equipment
- [ ] Region selector locked to 대구광역시

**Local Admin (대구 중구)**:
- [ ] Sees equipment in 대구 중구 by address
- [ ] Also sees equipment with `jurisdiction_health_center = 대구중구보건소`
- [ ] Cannot see equipment in 대구 영도구 or other regions
- [ ] City selector locked to 중구
- [ ] Can toggle between address and jurisdiction view

#### 5.3 Authorization Tests

Test `canAccessEquipment()` function:
```typescript
// Equipment in 대구 중구
const equipment = {
  sido: '대구광역시',
  gugun: '중구',
  jurisdiction_health_center: '대구중구보건소'
};

// Master can access
expect(await canAccessEquipment(masterUser, equipment, masterScope))
  .toEqual({ canAccess: true, matchedCriteria: 'master' });

// Regional admin (대구) can access
expect(await canAccessEquipment(regionalAdminDae, equipment, regionalScope))
  .toEqual({ canAccess: true, matchedCriteria: 'region' });

// Regional admin (부산) cannot access
expect(await canAccessEquipment(regionalAdminBussan, equipment, busonScope))
  .toEqual({ canAccess: false });

// Local admin (대구중구) can access by jurisdiction
expect(await canAccessEquipment(localAdminJunggu, equipment, jungguScope))
  .toEqual({ canAccess: true, matchedCriteria: 'jurisdiction' });
```

#### 5.4 Data Migration Validation

- [ ] All schedules still visible to original creators (via equipment access)
- [ ] Master-created schedules now visible to subordinates
- [ ] No data loss in migration
- [ ] FK constraints enforced

#### 5.5 Performance Testing

- [ ] Equipment query < 500ms for local admin (500+ records)
- [ ] Equipment query < 1000ms for regional admin (5000+ records)
- [ ] Master query < 2000ms for all equipment (81,000+ records)
- [ ] Jurisdiction post-filter < 100ms overhead

#### 5.6 Security Testing

- [ ] User cannot modify `aed_data_id` in POST request
- [ ] User cannot access equipment outside access scope
- [ ] Server-side authorization checks mandatory
- [ ] No client-side access bypasses

**Phase 5 Success Criteria**:
- All unit tests pass
- All integration tests pass (by role)
- All authorization tests pass
- Performance targets met
- No security vulnerabilities found
- Regression testing completed

---

## Technical Specifications

### Core Normalization Functions

These functions are critical for correct jurisdiction and region matching:

#### Organization Name Normalization

**Input Variations**:
- "대구 중구 보건소" (with spaces)
- "대구중구보건소" (without spaces)
- "대구중구보건소(중구청)" (with parentheses)
- "대구·중구 보건소" (with separators)

**Processing**:
1. Remove all whitespace
2. Remove parentheses and content
3. Remove special separators (·, •)
4. Convert to lowercase
5. Trim

**Output**: "대구중구보건소"

#### Region Code Mapping

**Input Formats**:
- Korean full: "대구광역시"
- Korean abbreviation: "대구"
- Code: "DAE"
- English: "DAEGU"

**Output**: Canonical Korean name "대구광역시"

### Access Scope Integration

The existing `resolveAccessScope()` function returns:
```typescript
interface UserAccessScope {
  allowedRegionCodes: string[] | null;  // Korean names, e.g., ["대구광역시"]
  allowedCityCodes: string[] | null;    // Korean names, e.g., ["중구", "남구"]
  // ... other fields
}
```

These values **directly match** `aed_data.sido` and `aed_data.gugun` formats, enabling seamless filtering.

### Post-Filter Strategy

Prisma WHERE clause cannot normalize strings, so jurisdiction matching uses:

```typescript
// Phase 1: Database query (Prisma)
const records = await prisma.inspection_schedule_entries.findMany({
  where: {
    aed_data: { jurisdiction_health_center: { not: null } }
  }
});

// Phase 2: Post-filter in application code
const filtered = postFilterJurisdictionAccess(records, userOrganizationName);
```

This two-phase approach:
- Minimizes DB query overhead (broad filter at DB level)
- Ensures accurate matching via normalized comparison
- Maintains flexibility for future changes

---

## Data Validation Strategy

### Phase 0 Comprehensive Validation

**Goal**: Ensure all data meets FK constraints before migration.

**Validation Steps**:

1. **NULL Serial Check**
   ```sql
   SELECT COUNT(*) FROM inspection_schedule_entries
   WHERE device_equipment_serial IS NULL;
   ```
   Expected: 0

2. **Orphan Records Check**
   ```sql
   SELECT ise.id, ise.device_equipment_serial
   FROM inspection_schedule_entries ise
   LEFT JOIN aed_data ad ON ise.device_equipment_serial = ad.equipment_serial
   WHERE ad.equipment_serial IS NULL
     AND ise.device_equipment_serial IS NOT NULL;
   ```
   Expected: Empty result

3. **Serial Length Validation**
   ```sql
   SELECT COUNT(*) FROM inspection_schedule_entries
   WHERE LENGTH(device_equipment_serial) > 255;
   ```
   Expected: 0

4. **Type Compatibility Check**
   ```sql
   SELECT DISTINCT data_type
   FROM information_schema.columns
   WHERE table_name = 'inspection_schedule_entries'
     AND column_name = 'device_equipment_serial';
   ```
   Expected: `character varying` (VARCHAR)

5. **Normalization Function Testing**
   - Test all 17 region codes
   - Test organization name variations
   - Verify no false positives/negatives

6. **Existing FK Verification**
   - Confirm `inspection_schedules.aed_data_id` works
   - Confirm `inspections.aed_data_id` works
   - Validate foreign key constraints

### Data Issues Handling

If validation fails:

| Issue | Resolution |
|-------|-----------|
| NULL serial | Set from schedule's `equipment_serial` field |
| Orphan record | Mark as inactive or delete if uncritical |
| Long serial | Trim or flag for manual review |
| Bad regex | Create mapping table for exception handling |

---

## Risk Management

### Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| FK constraint violation | Phase 1 failure | Low | Phase 0 validation |
| Jurisdiction mismatch | Wrong access level | Medium | Comprehensive testing |
| Cache consistency | Stale data | Low | 1-hour TTL + invalidation |
| Performance degradation | Slow queries | Medium | Index strategy + monitoring |
| API breaking changes | Client failures | High | Backward compatibility layer |

### Mitigation Strategies

1. **Phase 0 Validation**: Comprehensive data checks before schema change
2. **Backward Compatibility**: Maintain legacy `created_by` filters as fallback
3. **Gradual Rollout**: Enable equipment filtering via feature flag
4. **Monitoring**: Log all access decisions for audit
5. **Rollback Plan**: Full reversal possible up to Phase 2

---

## Rollback Procedures

### Rollback by Phase

#### Phase 0 Rollback
**Action**: No database changes yet; no rollback needed

#### Phase 1 Rollback (After Schema Migration)
```bash
# Step 1: Revert Prisma schema
git checkout prisma/schema.prisma

# Step 2: Create reverse migration
npx prisma migrate resolve --rolled-back "add_equipment_fk_to_inspections"

# Step 3: Apply reverse migration
npx prisma migrate deploy

# Step 4: Regenerate Prisma client
npx prisma generate
```

**Estimated Time**: 30 minutes
**Data Loss**: None
**Downtime**: 5 minutes

#### Phase 2+ Rollback (After API Changes)
```bash
# Option 1: Full rollback
git revert <commit-hash-phase-1>  # Reverts to Phase 0 state
git push origin main
pm2 reload ecosystem.config.js

# Option 2: Feature flag rollback (faster)
ENABLE_EQUIPMENT_CENTRIC_ACCESS=false pm2 reload ecosystem.config.js
```

**Estimated Time**: 10 minutes (feature flag) or 30 minutes (code revert)
**Data Loss**: None
**Downtime**: 0 (feature flag) or 5 minutes (code revert)

### Rollback Triggers

Automatic rollback initiated if:
- Phase 0: 5+ data issues found
- Phase 1: FK constraint violation on first records
- Phase 2: >50% API tests failing
- Phase 3+: Users cannot access equipment they previously could

---

## Success Criteria

### Phase-Level Success Criteria

| Phase | Success Criteria |
|-------|------------------|
| Phase 0 | All validations pass; migration-readiness-report.json generated |
| Phase 1 | Schema migration successful; no FK violations; `prisma generate` passes |
| Phase 2 | All API tests pass; authorization checks working; <1% access errors |
| Phase 3 | Cache hit rate > 80%; query latency < 500ms; no cache inconsistencies |
| Phase 4 | UI renders all accessible equipment; no breaking changes to workflows |
| Phase 5 | 100% test pass rate; no security vulnerabilities; performance targets met |

### End-to-End Success Criteria

After Phase 5:
- [ ] Master account can create schedule; visible to all subordinates
- [ ] Regional admin sees only accessible equipment
- [ ] Local admin sees equipment by jurisdiction OR address
- [ ] All 81,464 AED records properly accessible
- [ ] No data loss or corruption
- [ ] Performance within targets
- [ ] Security audited and verified
- [ ] Backward compatibility maintained
- [ ] Documentation updated

### Key Metrics

| Metric | Target | Monitoring |
|--------|--------|-----------|
| API latency | <500ms p95 | New Relic / CloudWatch |
| Cache hit rate | >80% | Redis stats |
| Authorization success | >99.9% | Application logs |
| Data accuracy | 100% | Daily audit script |
| Zero data loss | 100% | Pre/post migration comparison |

---

## Key Decisions and Rationale

### Decision 1: Equipment-Centric vs Organization-Centric

**Alternatives Considered**:
1. Add `organization_id` column (rejected)
2. Equipment-centric model (selected)
3. Hybrid user + organization filtering (rejected)

**Rationale for Equipment-Centric**:
- Resolves master account sharing without contradictions
- Aligns with existing `aed_data` schema
- Uses existing access scope calculation
- No new columns needed (leverages `jurisdiction_health_center`)
- Supports both address and jurisdiction filtering naturally

### Decision 2: Post-Filter for Jurisdiction

**Alternative**: Use Prisma raw SQL for normalized comparison
**Selected Approach**: Post-filter in application code

**Rationale**:
- Simpler implementation
- Easier to test and maintain
- Acceptable performance (milliseconds for <1000 records)
- No database-specific logic
- Can be optimized later if needed

### Decision 3: FK Strategy

**Alternative 1**: Unique constraint on `equipment_serial`
**Alternative 2**: Composite key (`organization_id`, `equipment_serial`)
**Selected**: Foreign key to `aed_data.id` (simple, single source of truth)

**Rationale**:
- `aed_data` is authoritative source for equipment
- Single FK relationship per table
- Automatic cascade options available
- Supports both serial and ID-based lookups

### Decision 4: Cache Duration (1 Hour)

**Alternatives**: 5 minutes, 15 minutes, 1 hour, 24 hours

**Selected**: 1 hour

**Rationale**:
- Role/region assignments change infrequently
- Balance between freshness and DB load
- User won't notice stale access scope
- Manual invalidation available for immediate changes
- TTL configurable via environment variable

### Decision 5: No `organization_id` Column

**Rejected Proposal**: Add `organization_id` FK to `inspection_schedules` and `inspection_assignments`

**Issues Identified**:
1. Master account has no organization (how to set organization_id?)
2. Same equipment might belong to multiple health centers (jurisdiction)
3. Regional admin works across multiple organizations within region
4. Would duplicate information already in `aed_data`
5. Data migration complexity for existing 315 organizations

**Selected Alternative**: Equipment-based filtering naturally handles all scenarios

---

## Conclusion

This equipment-centric architecture migration resolves the fundamental design flaw in the current system by making **equipment the source of truth** for data access, not the user who created the record.

The 6-phase approach provides:
- Comprehensive validation before changes
- Gradual, low-risk implementation
- Extensive testing and verification
- Full rollback capability
- Clear success metrics

Upon completion, the system will support:
- Seamless data sharing across organizational boundaries
- Consistent equipment visibility based on role and jurisdiction
- Maintained audit trails for compliance
- Performance targets for 250+ simultaneous users
- Foundation for future features (real-time sync, AI analysis, etc.)

---

**Document Control**:
- Version: 1.0
- Status: Ready for Phase 0 Execution
- Approval: [To be signed off by project stakeholder]
- Next Update: After Phase 0 completion
