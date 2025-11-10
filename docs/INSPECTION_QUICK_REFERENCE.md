# Inspection System - Quick Reference

## Key Files by Functionality

### Session Creation & Management (점검시작)

**Starting an Inspection**:
- Client: `/components/inspection/InspectionWorkflow.tsx` (Lines 50-100)
  - Calls: `useInspectionSessionStore.startSession(equipmentSerial)`
- State: `/lib/state/inspection-session-store.ts` (Lines 135-167)
  - Method: `startSession()` - creates session
- API: `/app/api/inspections/sessions/route.ts` (Lines 176-266)
  - Endpoint: `POST /api/inspections/sessions`
  - Creates: `inspection_sessions` record
  - Updates: `inspection_assignments` status to 'in_progress'

**Saving Progress**:
- Client: `useInspectionSessionStore.persistProgress()` (Lines 260-333)
- API: `PATCH /api/inspections/sessions` (Lines 268-531)
  - Updates: current_step, step_data, session status

**Completing Inspection**:
- Client: `useInspectionSessionStore.completeSession()` (Lines 335+)
- API: `PATCH /api/inspections/sessions` with `status: 'completed'`
  - Creates: `inspections` record (permanent)
  - Updates: session and assignment status to 'completed'
  - Transaction: All-or-nothing

**Cancelling Session**:
- Client: `useInspectionSessionStore.cancelSessionSafely()`
- API: `POST /api/inspections/sessions/[id]/cancel`
  - Updates: session status to 'cancelled' (soft delete)

---

## Authentication & Session Management

**NextAuth Configuration**:
- `/lib/auth/auth-options.ts`
  - Provider: Credentials (email/password)
  - Strategy: JWT
  - Max Age: 30 days
  - Cookie: httpOnly, secure in production

**Authentication Helpers**:
- `/lib/auth/session-helpers.ts`
  - `requireAuth()` - basic auth check
  - `requireAuthWithProfile()` - auth + user profile
  - `requireAuthWithOrganization()` - auth + profile + org
  - `isErrorResponse()` - type guard

**Session Extraction**:
- Middleware: `/middleware.ts` (Lines 6-29)
  - Extracts JWT token from request
  - Gets user role for route protection
- API Routes: `getServerSession(authOptions)` from NextAuth

---

## Authorization & Access Control

**Middleware Route Protection** (Lines 57-104):
```
Protected Routes:
- /dashboard
- /inspection        <- Inspection access checked here
- /aed-data
- /admin             <- Admin role required
- /profile
- /team-dashboard
```

**Admin Routes** (Lines 78-85):
```
Required Roles:
- master
- emergency_center_admin
- regional_emergency_center_admin
```

**Inspection Access**:
- Middleware: Checks `canAccessInspection` flag
- API: Uses `canPerformInspection()` and `canAccessDevice()`

---

## API Endpoints Summary

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/inspections/sessions` | List user's sessions | Yes |
| GET | `/api/inspections/sessions?sessionId=X` | Get specific session | Yes |
| POST | `/api/inspections/sessions` | Start new inspection | Yes |
| PATCH | `/api/inspections/sessions` | Update/complete session | Yes |
| DELETE | `/api/inspections/sessions?sessionId=X` | Cancel session | Yes |
| POST | `/api/inspections/sessions/[id]/cancel` | Cancel with reason | Yes |
| POST | `/api/inspections/sessions/[id]/refresh` | Refresh device data | Yes |
| POST | `/api/inspections/quick` | Quick inspection (alt flow) | Yes |

---

## Error Codes

### HTTP Status Codes
- **400**: Bad Request (validation, missing required fields, data integrity)
- **401**: Unauthorized (no session or invalid token)
- **403**: Forbidden (permission denied, device not assigned)
- **404**: Not Found (session, device, or user not found)
- **500**: Internal Server Error (database, system errors)

### Error Types
- `DATA_INTEGRITY_ERROR`: Equipment not in aed_data (status: 400)
- `SYSTEM_ERROR`: Unexpected server error (status: 500)
- `VALIDATION_ERROR`: Input validation failed

---

## Data Models

### inspection_sessions (Temporary)
```typescript
{
  id: string;
  equipment_serial: string;
  inspector_id: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  current_step: number;  // 0-4
  step_data: Record<string, unknown>;
  device_info: Record<string, unknown>;
  started_at: Date;
  completed_at?: Date;
  cancelled_at?: Date;
  updated_at: Date;
}
```

### inspections (Permanent)
```typescript
{
  id: string;
  equipment_serial: string;
  aed_data_id: number;
  inspector_id: string;
  inspection_date: Date;
  inspection_type: 'monthly' | 'special';
  battery_status: 'good' | 'replaced';
  pad_status: 'good' | 'replaced';
  overall_status: 'pass' | 'fail' | 'pending';
  issues_found: string[];
  photos: string[];
  notes?: string;
  inspected_data: Record<string, unknown>;
}
```

---

## Inspection Workflow Steps

**Step 0**: BasicInfoStep - Location & device verification
**Step 1**: DeviceInfoStep - Battery, pad, serial number verification
**Step 2**: StorageChecklistStep - Storage box and accessories check
**Step 3**: ManagerEducationStep - Training/education verification
**Step 4**: InspectionSummaryStep - Review and confirm all data

---

## Session State Management (Zustand)

### Store State
```typescript
{
  session: InspectionSession | null;
  currentStep: number;
  stepData: Record<string, unknown>;
  lastSavedStepData: Record<string, unknown>;
  issues: InspectionIssue[];
  isLoading: boolean;
  error?: string;
  pendingChanges: PendingChange[];
}
```

### Key Methods
- `startSession(equipmentSerial)` - Create new session
- `loadSession(sessionId)` - Recover existing session
- `setCurrentStep(step)` - Navigate to step
- `updateStepData(key, data)` - Update step data locally
- `persistProgress()` - Save to server
- `completeSession()` - Finalize and submit
- `cancelSessionSafely()` - Cancel with data preservation
- `resetSession()` - Clear all state

---

## Important Validation Rules

**Session Creation**:
- Must have valid equipment_serial
- User must have active inspection_assignments for device
- Equipment must exist in aed_data table
- Cannot create duplicate active sessions

**Session Completion**:
- equipment_serial must be in aed_data (FK validation)
- All required step_data must be present
- Transaction ensures atomicity (all-or-nothing)

**Session Cancellation**:
- Only session owner (inspector_id) can cancel
- Completed sessions cannot be cancelled
- Cancellation is recorded (soft delete)

**Refresh Data**:
- Only allowed before inspection starts (current_step == 0)
- Cannot refresh during active inspection

---

## Connection Recovery

**If User Loses Connection**:
1. Client has sessionId stored in store
2. Call `loadSession(sessionId)` to recover
3. Session state restored from DB
4. User can resume from last saved step

**If Session Expires**:
- NextAuth JWT expires after 30 days
- User must re-login
- Active inspection_sessions remain in DB
- Can recover after re-login using sessionId

---

## No Logout Logic in Inspection Workflow

**Important Finding**: 
- Search for logout/signOut in inspection files: NO MATCHES
- Logout handled by NextAuth at `/api/auth/signout`
- Logout does NOT automatically cancel inspections
- Recommendation: Implement pre-logout session cancellation

---

## File Tree Summary

```
/app/api/inspections/
├── sessions/
│   ├── route.ts                 <- Main session API
│   └── [id]/
│       ├── cancel/route.ts      <- Cancel session
│       └── refresh/route.ts     <- Refresh device data
├── quick/route.ts              <- Quick inspection (alt flow)
├── history/route.ts            <- Inspection history
└── [id]/route.ts               <- Single inspection CRUD

/lib/
├── state/
│   └── inspection-session-store.ts  <- Zustand store
├── inspections/
│   └── session-utils.ts            <- Session utility functions
├── auth/
│   ├── auth-options.ts             <- NextAuth config
│   ├── session-helpers.ts          <- Auth helpers
│   └── access-control.ts           <- Permission checks
└── (other utilities)

/components/inspection/
├── InspectionWorkflow.tsx      <- Main UI component
├── steps/
│   ├── BasicInfoStep.tsx
│   ├── DeviceInfoStep.tsx
│   ├── StorageChecklistStep.tsx
│   ├── ManagerEducationStep.tsx
│   └── InspectionSummaryStep.tsx
└── (other components)

/middleware.ts                   <- Route protection
```

---

## Quick Testing Checklist

- [ ] Can start inspection (POST sessions)
- [ ] Can see active session (GET sessions?status=active)
- [ ] Can update step (PATCH sessions)
- [ ] Can save progress (persistProgress)
- [ ] Can complete inspection (status='completed')
- [ ] Can cancel session (POST cancel)
- [ ] Completed sessions cannot be cancelled
- [ ] Only owner can cancel session
- [ ] Data integrity validation works
- [ ] Cannot start without equipment_serial
- [ ] Cannot start without assignment
- [ ] Session persists after disconnect
- [ ] Can recover with sessionId

---

**Document Version**: 1.0
**Last Updated**: 2025-11-10
**Comprehensive Reference**: See `/docs/INSPECTION_SESSION_MANAGEMENT.md`
