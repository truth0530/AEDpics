# AED Inspection System - Session Management & Inspection Start Flow

## Overview

This document details all files and code sections related to inspection start functionality (점검시작) and session management in the AEDpics system.

---

## 1. Inspection Session Start API

### Primary Endpoint: `/api/inspections/sessions` (POST)

**File**: `/Users/kwangsunglee/Projects/AEDpics/app/api/inspections/sessions/route.ts`

**Purpose**: Creates a new inspection session when a user starts inspecting a device

**Key Functionality (Lines 176-266)**:
```typescript
export async function POST(request: NextRequest) {
  // 1. User authentication check via requireAuthWithRole()
  // 2. Validates equipment_serial in payload
  // 3. Checks for active sessions (prevents duplicates)
  // 4. Verifies inspection_assignments authorization
  // 5. Fetches device data from aed_data table
  // 6. Creates new inspection_sessions record
  // 7. Updates assignment status to 'in_progress'
  
  const newSession = await prisma.inspection_sessions.create({
    data: {
      equipment_serial: payload.equipment_serial,
      inspector_id: userId,
      status: 'active',
      current_step: 0,
      step_data: {},
      device_info: deviceData,
      started_at: new Date()
    }
  });
}
```

**Request Payload**:
```typescript
interface StartSessionPayload {
  equipment_serial?: string;
  deviceSnapshot?: Record<string, unknown> | null;
}
```

**Response**: Returns `{ session: InspectionSession }`

**Error Handling**:
- 401: Unauthorized (no session/user)
- 400: Missing equipment_serial
- 403: Device not assigned to user
- 404: Device not found in aed_data

---

## 2. Session Management Store (Zustand)

### Client-Side State Management

**File**: `/Users/kwangsunglee/Projects/AEDpics/lib/state/inspection-session-store.ts`

**Purpose**: Manages inspection session state on the client side

**Key Methods**:

#### 2.1 startSession()
```typescript
async startSession(equipmentSerial) {
  // Calls POST /api/inspections/sessions
  // Creates new inspection session
  // Initializes stepData from response
  // Sets currentStep to 0
  
  const { session } = await parseResponse<{ session: InspectionSession }>(response);
  set({
    session,
    currentStep: session.current_step ?? 0,
    stepData: initialStepData,
    lastSavedStepData: cloneDeep(initialStepData),
    isLoading: false,
    pendingChanges: [],
  });
}
```

#### 2.2 persistProgress()
```typescript
async persistProgress(options) {
  // Sends PATCH request to /api/inspections/sessions
  // Saves current step, step data, and field changes
  // Updates lastSavedStepData on success
  
  const payload = {
    sessionId: session.id,
    currentStep,
    stepData,
    fieldChanges: session.field_changes || {},
    status: options?.status,
    notes: options?.notes
  };
}
```

#### 2.3 completeSession()
```typescript
async completeSession(finalData) {
  // Transforms stepData to inspection format
  // Sends PATCH request with status: 'completed'
  // Includes finalizeData with all inspection data
  // Creates inspection record and updates session status
}
```

#### 2.4 cancelSessionSafely()
```typescript
async cancelSessionSafely() {
  // Safely cancels session without data loss
  // Calls DELETE /api/inspections/sessions
  // Updates session status to 'cancelled'
}
```

**Session Status Values** (Lines 97-99):
```typescript
const SESSION_STATUS_VALUES = ['active', 'paused', 'completed', 'cancelled'] as const;
type SessionStatus = typeof SESSION_STATUS_VALUES[number];
```

---

## 3. Session Update/Completion API

### PATCH Endpoint: `/api/inspections/sessions`

**File**: `/Users/kwangsunglee/Projects/AEDpics/app/api/inspections/sessions/route.ts` (Lines 268-531)

**Purpose**: Updates session step/status or completes the inspection

**Completion Flow (Lines 306-479)**:
```typescript
if (payload.status === 'completed' && payload.finalizeData) {
  // Transaction-based processing
  // 1. Validates and extracts deviceInfo, basicInfo, storage data
  // 2. Creates issues_found array from validation results
  // 3. Collects photos from step data
  // 4. Looks up aed_data record (FK validation)
  // 5. Creates inspection record with all data
  // 6. Updates session status to 'completed'
  // 7. Updates assignment status to 'completed'
}
```

**Error Handling**:
- 400: Bad Request (missing sessionId, data integrity errors)
- 403: Forbidden (user doesn't own session)
- 404: Session not found
- 500: Internal server error

**Data Integrity Check** (Lines 357-362):
```typescript
if (!aedData) {
  const errorMsg = `[DATA_INTEGRITY_ERROR] Equipment ${session.equipment_serial} 
                    not registered in AED database...`;
  throw new Error(errorMsg);
}
```

---

## 4. Session Cancel API

### POST Endpoint: `/api/inspections/sessions/[id]/cancel`

**File**: `/Users/kwangsunglee/Projects/AEDpics/app/api/inspections/sessions/[id]/cancel/route.ts`

**Purpose**: Cancels an ongoing inspection session (soft delete)

**Key Features**:
```typescript
// 1. Authenticate user via NextAuth
// 2. Validate session ownership (inspector_id must match session.user.id)
// 3. Prevent cancellation of completed sessions
// 4. Update session status to 'cancelled'
// 5. Record cancellation timestamp and reason

await prisma.inspection_sessions.update({
  where: { id: sessionId },
  data: {
    status: 'cancelled',
    cancelled_at: new Date(),
    notes: reason ? `취소 사유: ${reason}` : inspectionSession.notes,
    updated_at: new Date()
  }
});
```

**Error Handling**:
- 401: Unauthorized
- 403: Only session owner can cancel
- 404: Session not found
- 400: Cannot cancel completed session
- 500: Database update error

---

## 5. Session Refresh API

### POST Endpoint: `/api/inspections/sessions/[id]/refresh`

**File**: `/Users/kwangsunglee/Projects/AEDpics/app/api/inspections/sessions/[id]/refresh/route.ts`

**Purpose**: Refreshes device data snapshot during inspection setup phase

**Restrictions** (Lines 44-53):
```typescript
// Cannot refresh during active inspection
if (inspectionSession.status === 'active' && inspectionSession.current_step > 0) {
  return NextResponse.json(
    {
      error: 'Cannot refresh during active inspection',
      message: '점검 진행 중에는 데이터를 갱신할 수 없습니다.'
    },
    { status: 400 }
  );
}
```

**Data Update** (Lines 56-72):
```typescript
const latestData = await prisma.aed_data.findUnique({
  where: { equipment_serial: inspectionSession.equipment_serial }
});

await prisma.inspection_sessions.update({
  where: { id: sessionId },
  data: {
    device_info: latestData as any,
    updated_at: new Date()
  }
});
```

---

## 6. Session Retrieval API

### GET Endpoint: `/api/inspections/sessions`

**File**: `/Users/kwangsunglee/Projects/AEDpics/app/api/inspections/sessions/route.ts` (Lines 106-174)

**Purpose**: Retrieves user's inspection sessions with optional filtering

**Query Parameters**:
```typescript
const sessionId = searchParams.get('sessionId');  // Get specific session
const statusParam = searchParams.get('status');   // Filter by status
// status values: 'active', 'paused', 'completed', 'cancelled', 'all'
```

**Default Behavior** (Lines 148-156):
```typescript
const DEFAULT_ACTIVE_STATUSES: SessionStatus[] = ['active', 'paused'];

// If no status specified, returns active and paused sessions
const statusesToQuery = statusFilter ?? 
  (!statusParam ? DEFAULT_ACTIVE_STATUSES : undefined);
```

**Response**: Returns array of inspection_sessions filtered by status and user

---

## 7. NextAuth Configuration

### Authentication Setup

**File**: `/Users/kwangsunglee/Projects/AEDpics/lib/auth/auth-options.ts`

**Key Configuration**:
```typescript
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      credentials: { email, password },
      async authorize(credentials) {
        // 1. Validates credentials
        // 2. Checks user account status (active, locked)
        // 3. Records successful login in login_history
        // 4. Updates last_login_at
        // 5. Returns user object with role info
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt({ token, user }) {
      // Token includes: id, role, organizationId, organizationName
    },
    session({ session, token }) {
      // Session includes: user.id, user.role, user.organizationId
    }
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  }
}
```

**Cookie Configuration**:
```typescript
cookies: {
  sessionToken: {
    name: process.env.NODE_ENV === 'production'
      ? `__Secure-next-auth.session-token`
      : `next-auth.session-token`,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: "lax",
      path: "/"
    }
  }
}
```

---

## 8. Session Helper Functions

### Authentication Helpers

**File**: `/Users/kwangsunglee/Projects/AEDpics/lib/auth/session-helpers.ts`

**Key Functions**:

#### 8.1 requireAuth()
```typescript
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return {
    session,
    userId: session.user.id,
  };
}
```

#### 8.2 requireAuthWithProfile()
```typescript
export async function requireAuthWithProfile<T = user_profiles>(
  select?: Record<string, boolean>
): Promise<(AuthResult & { profile: T }) | NextResponse> {
  // Authenticates user and loads profile
  // Supports custom field selection
}
```

#### 8.3 requireAuthWithOrganization()
```typescript
export async function requireAuthWithOrganization(): Promise<
  AuthWithOrganizationResult | NextResponse
> {
  // Authenticates user, loads profile and organization
  // Ensures user is associated with organization
}
```

#### 8.4 isErrorResponse()
```typescript
export function isErrorResponse(result: any): result is NextResponse {
  return result instanceof NextResponse;
}
```

---

## 9. Inspection Session Utilities

### Session Management Functions

**File**: `/Users/kwangsunglee/Projects/AEDpics/lib/inspections/session-utils.ts`

**Key Functions**:

#### 9.1 getActiveInspectionSessions()
```typescript
export async function getActiveInspectionSessions(): Promise<Map<string, InspectionSession>> {
  // Fetches from GET /api/inspections/sessions?status=active
  // Returns Map<equipment_serial, session>
  // Used by AdminFullView to show ongoing inspections
}
```

#### 9.2 getCompletedInspections()
```typescript
export async function getCompletedInspections(hoursAgo: number = 24): Promise<Set<string>> {
  // Fetches completed inspections from past N hours
  // Returns Set<equipment_serial>
}
```

#### 9.3 cancelInspectionSession()
```typescript
export async function cancelInspectionSession(
  sessionId: string, 
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // Calls POST /api/inspections/sessions/{sessionId}/cancel
}
```

#### 9.4 getInspectionHistory()
```typescript
export async function getInspectionHistory(
  equipmentSerial?: string,
  hoursAgo: number = 24,
  mode: 'address' | 'jurisdiction' = 'address'
): Promise<InspectionHistory[]> {
  // Fetches completed inspection records
  // Supports filtering by equipment and time range
}
```

---

## 10. Middleware - Request Routing & Authentication

### Authentication Middleware

**File**: `/Users/kwangsunglee/Projects/AEDpics/middleware.ts`

**Key Features**:

#### 10.1 User Role Extraction (Lines 6-29)
```typescript
async function getUserRole(request: NextRequest): Promise<UserRole | null> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });
  
  if (!token?.id) return null;
  
  const role = token.role as UserRole;
  
  return role || null;
}
```

#### 10.2 Protected Routes (Lines 57-104)
```typescript
const protectedRoutes = [
  '/dashboard', 
  '/inspection',  // <- Inspection access controlled here
  '/aed-data', 
  '/admin', 
  '/profile', 
  '/team-dashboard'
];

// Unauthenticated users redirected to /auth/signin
if (!userRole && isProtectedRoute) {
  const loginUrl = new URL('/auth/signin', request.url);
  return NextResponse.redirect(loginUrl);
}
```

#### 10.3 Role-Based Access Control (Lines 78-101)
```typescript
// /admin requires: master, emergency_center_admin, regional_emergency_center_admin
if (pathname.startsWith('/admin')) {
  const adminRoles: UserRole[] = [
    'master', 
    'emergency_center_admin', 
    'regional_emergency_center_admin'
  ];
  if (!adminRoles.includes(userRole)) {
    return NextResponse.redirect(accessRights.fallbackRoute);
  }
}

// /inspection access controlled via canAccessInspection flag
if (pathname.startsWith('/inspection')) {
  if (!accessRights.canAccessInspection) {
    return NextResponse.redirect(accessRights.fallbackRoute);
  }
}
```

---

## 11. Inspection Workflow Component

### Client-Side UI Management

**File**: `/Users/kwangsunglee/Projects/AEDpics/components/inspection/InspectionWorkflow.tsx`

**Key Functionality**:

#### 11.1 Session Integration (Lines 50-82)
```typescript
export function InspectionWorkflow({ deviceSerial, deviceData, heading }) {
  const session = useInspectionSessionStore((state) => state.session);
  const currentStep = useInspectionSessionStore((state) => state.currentStep);
  const persistProgress = useInspectionSessionStore((state) => state.persistProgress);
  const completeSession = useInspectionSessionStore((state) => state.completeSession);
  const cancelSessionSafely = useInspectionSessionStore((state) => state.cancelSessionSafely);
  
  // Detects completed sessions
  useEffect(() => {
    if (session?.status === 'completed') {
      setShowReopenModal(true);
    }
  }, [session?.status, session?.id]);
}
```

#### 11.2 Auto-Save Mutation (Lines 93-101)
```typescript
const saveProgressMutation = useMutation({
  mutationFn: async () => {
    await persistProgress();  // Calls PATCH to save current progress
  },
  onSuccess: () => {
    console.log('Progress saved successfully');
  },
});
```

---

## 12. Quick Inspection API

### Alternative Inspection Start Flow

**File**: `/Users/kwangsunglee/Projects/AEDpics/app/api/inspections/quick/route.ts`

**Purpose**: Creates quick inspection record directly (bypasses session workflow)

**Key Differences from Session-Based Flow**:
```typescript
export async function POST(request: NextRequest) {
  // 1. Authorization via canPerformInspection() and canAccessDevice()
  // 2. Direct device lookup in aed_data table
  // 3. Creates inspection record immediately
  // 4. Does not create inspection_sessions record
  
  const inspection = await prisma.inspections.create({
    data: {
      aed_data_id: device.id,
      equipment_serial: device.equipment_serial,
      inspector_id: session.user.id,
      inspection_type: 'special',
      overall_status: 'pending',
    },
  });
}
```

---

## 13. Data Flow Diagram

```
User Clicks Start Inspection
    |
    v
InspectionWorkflow.tsx calls useInspectionSessionStore.startSession()
    |
    v
POST /api/inspections/sessions
    |
    +-- Check authentication (NextAuth JWT)
    |
    +-- Validate equipment_serial
    |
    +-- Check inspection_assignments (user authorized for device)
    |
    +-- Fetch device data from aed_data table
    |
    v
Create inspection_sessions record (status: 'active', current_step: 0)
Update inspection_assignments (status: 'in_progress')
    |
    v
Return session object to client
    |
    v
Store updates (Zustand): session, currentStep, stepData
    |
    v
Display first step (BasicInfoStep)

--- During Inspection ---

User enters data -> updateStepData() -> Update local state
User navigates steps -> setCurrentStep()
User clicks Save -> persistProgress() -> PATCH /api/inspections/sessions

PATCH /api/inspections/sessions
    |
    +-- Check authentication
    |
    +-- Validate sessionId ownership
    |
    +-- Update: current_step, step_data, status
    |
    v
Return updated session to client

--- When Completing ---

User clicks Complete -> completeSession() -> PATCH /api/inspections/sessions (status: 'completed')
    |
    +-- Transaction: 
    |
    +-- Validate aed_data FK
    |
    +-- Create inspections record
    |
    +-- Update session status to 'completed'
    |
    +-- Update assignment status to 'completed'
    |
    v
Transaction commits or rolls back entirely
```

---

## 14. Error Handling Strategy

### API Error Responses

**Unified Error Format**:
```typescript
interface ApiErrorResponse {
  error: string;
  type?: 'DATA_INTEGRITY_ERROR' | 'SYSTEM_ERROR' | 'VALIDATION_ERROR';
  details?: {
    code?: string;
    message?: string;
  };
}

// HTTP Status Codes Used:
// 400: Bad Request (validation, data integrity errors)
// 401: Unauthorized (missing session/user)
// 403: Forbidden (permission denied, not assigned)
// 404: Not Found (session, device, user not found)
// 500: Internal Server Error (database, system errors)
```

**Client-Side Error Handling** (session-store.ts Lines 108-124):
```typescript
async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    let message = typeof payload?.error === 'string' 
      ? payload.error 
      : '요청을 처리하지 못했습니다.';
    
    if (payload?.code === 'VALIDATION_ERROR' && payload?.message) {
      message = payload.message;
    } else if (payload?.details && Array.isArray(payload.details)) {
      message = payload.details.join(' | ');
    }
    
    throw new ApiError(message, response.status, payload);
  }
  return payload as T;
}
```

---

## 15. Session Status State Machine

```
┌─────────────────────────────────────────┐
│          Initial State                  │
│  No active session                      │
└─────────────────────────────────────────┘
                   |
                   v
   User calls startSession(equipmentSerial)
                   |
                   v
┌─────────────────────────────────────────┐
│         ACTIVE (current_step: 0)        │
│  Session created, awaiting first step   │
└─────────────────────────────────────────┘
         |                         |
         v                         v
   persistProgress()        cancelSession()
   (setCurrentStep)         (soft delete)
         |                         |
         v                         v
┌─────────────────────────────────────────┐┌──────────────────────────┐
│         ACTIVE (current_step: 1-4)      ││  CANCELLED               │
│  Steps 1-4 (BasicInfo, Device,          ││  Session cancelled       │
│  Storage, ManagerEducation)             ││  (saved in DB)           │
└─────────────────────────────────────────┘└──────────────────────────┘
         |
         v
   completeSession(finalData)
         |
         v
┌─────────────────────────────────────────┐
│         COMPLETED                       │
│  inspections record created             │
│  assignment marked as completed         │
│  session status: 'completed'            │
└─────────────────────────────────────────┘
```

---

## 16. Session vs. Inspection Distinction

### inspection_sessions Table (Temporary)
- Created when inspection starts
- Tracks current step and progress
- Holds step_data during workflow
- Status: active -> completed/cancelled
- Soft deleted (status changed, record kept)

### inspections Table (Permanent)
- Created when inspection COMPLETES
- Contains final inspection results
- Permanent record for auditing
- References equipment_serial and inspector_id
- Contains issues_found, photos, status assessments

---

## 17. Summary of Key File Locations

| Component | File Path |
|-----------|-----------|
| Session Creation API | `/app/api/inspections/sessions/route.ts` |
| Session Cancel API | `/app/api/inspections/sessions/[id]/cancel/route.ts` |
| Session Refresh API | `/app/api/inspections/sessions/[id]/refresh/route.ts` |
| Session State Store | `/lib/state/inspection-session-store.ts` |
| Session Utilities | `/lib/inspections/session-utils.ts` |
| Auth Config | `/lib/auth/auth-options.ts` |
| Session Helpers | `/lib/auth/session-helpers.ts` |
| Workflow Component | `/components/inspection/InspectionWorkflow.tsx` |
| Quick Inspection API | `/app/api/inspections/quick/route.ts` |
| Middleware | `/middleware.ts` |

---

## 18. No Logout-Related Logic in Inspection Workflow

**Finding**: Search for logout/signOut patterns returned no results in inspection-related files.

**NextAuth Logout Mechanism**:
- Handled by NextAuth default signout endpoint: `/api/auth/signout`
- Uses session token invalidation (cookie removal)
- Does not directly affect inspection sessions
- Inspection sessions remain in DB with 'active' status if user logs out mid-inspection

**Recommended Practice**: 
- Cancel active inspection session before logout
- Or implement session cleanup on login to mark stale sessions as 'abandoned'

---

## 19. Key Authentication Flow

```
1. User enters credentials (email, password)
2. POST /api/auth/signin (NextAuth route)
3. CredentialsProvider.authorize() validates:
   - User exists in user_profiles
   - Password hash matches
   - Account is active (is_active: true)
   - Account not locked
4. On success:
   - Creates login_history record
   - Updates last_login_at
   - Returns user object with role
5. NextAuth JWT callback:
   - Embeds user.id, role, organizationId in token
6. NextAuth session callback:
   - Adds user.id, user.role to session
7. Token stored in secure httpOnly cookie
8. Middleware extracts token for route protection
9. API endpoints use getServerSession() to verify
```

---

## 20. Inspection Session Recovery

**If User Loses Connection**:
```typescript
// Client can call loadSession(sessionId) to recover
// This fetches existing session from DB
// User can resume from last saved step

const { session } = await fetch(`/api/inspections/sessions?sessionId=${sessionId}`)
// Session state restored from DB
// Can resume from current_step
```

**If Server Session Expires**:
- NextAuth session maxAge: 30 days
- JWT token expires after 30 days
- User must re-login
- Active inspection_sessions remain in DB

