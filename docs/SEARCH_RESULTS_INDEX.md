# Search Results Index - Inspection Session Management

## Search Date: 2025-11-10
## Search Focus: Inspection Start (점검시작) & Session Management

---

## Key Discoveries

### 1. Inspection Session Start Flow
Located in `/app/api/inspections/sessions/route.ts` (Lines 176-266)

**HTTP**: POST /api/inspections/sessions
**Purpose**: Creates new inspection_sessions record when user starts inspection
**Request**: `{ equipment_serial: string }`
**Response**: `{ session: InspectionSession }`

**Process**:
1. Authenticate user via NextAuth JWT
2. Validate equipment_serial exists
3. Check inspection_assignments (user authorized for device)
4. Fetch device data from aed_data table
5. Create inspection_sessions with status='active', current_step=0
6. Update assignment status to 'in_progress'

---

### 2. Client-Side State Management
Located in `/lib/state/inspection-session-store.ts`

**Type**: Zustand store
**Key Methods**:
- `startSession(equipmentSerial)` - Create session
- `loadSession(sessionId)` - Recover session
- `persistProgress(options)` - Save progress
- `completeSession(finalData)` - Finalize inspection
- `cancelSessionSafely()` - Cancel session

**State Values**:
- session: InspectionSession | null
- currentStep: number (0-4)
- stepData: Record<string, unknown>
- isLoading: boolean
- error?: string

---

### 3. Session Update & Completion
Located in `/app/api/inspections/sessions/route.ts` (Lines 268-531)

**HTTP**: PATCH /api/inspections/sessions
**Purpose**: Update session progress or complete inspection

**Update Mode** (typical progress save):
- Updates: current_step, step_data, session status
- Returns: updated session object

**Completion Mode** (status='completed'):
- Validates aed_data FK exists
- Creates inspections record (permanent)
- Updates session status='completed'
- Updates assignment status='completed'
- Transaction-based: all-or-nothing

---

### 4. Session Cancellation
Located in `/app/api/inspections/sessions/[id]/cancel/route.ts`

**HTTP**: POST /api/inspections/sessions/[id]/cancel
**Purpose**: Cancel ongoing inspection session
**Constraints**:
- Only session owner can cancel
- Cannot cancel completed sessions
- Updates status='cancelled' (soft delete)
- Records cancellation timestamp and reason

---

### 5. NextAuth Configuration
Located in `/lib/auth/auth-options.ts`

**Authentication Type**: JWT-based Credentials Provider
**Session Duration**: 30 days
**Cookie**: httpOnly, secure in production, sameSite='lax'

**Token Contents**:
```typescript
{
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
}
```

---

### 6. Authentication Helpers
Located in `/lib/auth/session-helpers.ts`

**Available Functions**:
- `requireAuth()` - Basic session validation
- `requireAuthWithProfile()` - Session + user profile
- `requireAuthWithOrganization()` - Session + profile + organization
- `isErrorResponse()` - Type guard for error responses

**Usage Pattern**:
All API routes in inspection system use one of these helpers
to validate authentication before processing requests.

---

### 7. Middleware Route Protection
Located in `/middleware.ts`

**Protected Routes**:
- /dashboard
- /inspection (inspection access controlled here)
- /aed-data
- /admin (admin roles only)
- /profile
- /team-dashboard

**Execution**:
1. Extract JWT token from request
2. Get user role from token
3. Check if route is protected
4. Verify role has access rights
5. Redirect unauthenticated users to /auth/signin
6. Redirect unauthorized users to fallback route

---

### 8. Session Utilities
Located in `/lib/inspections/session-utils.ts`

**Client-Side Helper Functions**:
- `getActiveInspectionSessions()` - Fetch active sessions
- `getCompletedInspections(hoursAgo)` - Fetch completed
- `cancelInspectionSession(sessionId, reason)` - Cancel
- `getInspectionHistory(serial, hoursAgo, mode)` - History
- `loadSession(sessionId)` - Load existing session

---

### 9. Workflow UI Component
Located in `/components/inspection/InspectionWorkflow.tsx`

**Purpose**: Main UI component managing inspection workflow
**Integration**: Uses Zustand store for state management
**Features**:
- Detects session status changes
- Handles step navigation
- Triggers auto-save on progress
- Shows completion modal when finished
- Allows session reopening

---

### 10. Quick Inspection (Alternative Flow)
Located in `/app/api/inspections/quick/route.ts`

**HTTP**: POST /api/inspections/quick
**Purpose**: Alternative to session-based workflow
**Differences**:
- Bypasses session_workflow
- Creates inspection record directly
- No multi-step process
- Does NOT create inspection_sessions

---

## Important Finding: No Logout Logic

**Search Result**: "logout" / "signOut" = NO MATCHES in inspection files

**Implication**: 
- Logout is handled separately by NextAuth
- Logout does NOT cancel active inspection_sessions
- Sessions remain in DB if user logs out mid-inspection
- Recommendation: Implement pre-logout cancellation

---

## Data Models

### inspection_sessions (Temporary)
```typescript
{
  id: string;
  equipment_serial: string;
  inspector_id: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  current_step: number;
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

## API Endpoints Quick Reference

| Method | Endpoint | Status | Handler |
|--------|----------|--------|---------|
| GET | /api/inspections/sessions | 200 | Gets user sessions |
| GET | /api/inspections/sessions?sessionId=X | 200 | Gets specific session |
| POST | /api/inspections/sessions | 200 | Creates new session |
| PATCH | /api/inspections/sessions | 200 | Updates/completes |
| DELETE | /api/inspections/sessions?sessionId=X | 200 | Cancels session |
| POST | /api/inspections/sessions/[id]/cancel | 200 | Cancel with reason |
| POST | /api/inspections/sessions/[id]/refresh | 200 | Refresh device data |
| POST | /api/inspections/quick | 200 | Quick inspection |

---

## Error Status Codes

- **400**: Bad Request (validation, missing fields, data integrity)
- **401**: Unauthorized (no session, invalid token)
- **403**: Forbidden (permission denied, not assigned)
- **404**: Not Found (session, device, or user not found)
- **500**: Internal Server Error (database, system errors)

---

## Session Status State Machine

```
Initial
  ↓
ACTIVE (current_step: 0)
  ├→ CANCELLED (soft delete)
  └→ ACTIVE (current_step: 1-4)
      └→ COMPLETED (creates inspections record)
```

---

## All Files Found

### API Routes (5 files)
- `/app/api/inspections/sessions/route.ts`
- `/app/api/inspections/sessions/[id]/cancel/route.ts`
- `/app/api/inspections/sessions/[id]/refresh/route.ts`
- `/app/api/inspections/quick/route.ts`
- `/app/api/auth/[...nextauth]/route.ts` (reference)

### State Management (1 file)
- `/lib/state/inspection-session-store.ts`

### Utilities (2 files)
- `/lib/inspections/session-utils.ts`
- `/lib/auth/access-control.ts` (referenced)

### Authentication (2 files)
- `/lib/auth/auth-options.ts`
- `/lib/auth/session-helpers.ts`

### UI Components (1 file)
- `/components/inspection/InspectionWorkflow.tsx`

### Middleware (1 file)
- `/middleware.ts`

---

## Comprehensive Documentation

Two detailed documents have been created:

### 1. INSPECTION_SESSION_MANAGEMENT.md (827 lines)
Comprehensive reference covering:
- All 20 key components
- Data flow diagrams
- Session status machines
- Error handling strategy
- Code examples with line numbers
- Recovery procedures

**Location**: `/Users/kwangsunglee/Projects/AEDpics/docs/INSPECTION_SESSION_MANAGEMENT.md`

### 2. INSPECTION_QUICK_REFERENCE.md (280+ lines)
Quick reference guide for developers:
- API endpoints summary table
- File locations and purposes
- Data models
- Validation rules
- Testing checklist
- Connection recovery procedures

**Location**: `/Users/kwangsunglee/Projects/AEDpics/docs/INSPECTION_QUICK_REFERENCE.md`

---

## Next Steps for Implementation

1. **Logout Handling**: Add session cancellation before logout
2. **Session Recovery**: Implement UI for session recovery on reconnect
3. **Stale Sessions**: Add cleanup for abandoned sessions (>24h inactive)
4. **Error UI**: Implement error display for data integrity failures
5. **Monitoring**: Add metrics for session lifecycle events

---

**Search Completed**: 2025-11-10
**Total Components Found**: 20+
**Total Lines Analyzed**: 3000+
**Documentation Generated**: 1100+ lines
