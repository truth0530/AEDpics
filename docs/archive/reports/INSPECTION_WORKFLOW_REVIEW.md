# 현장점검 업무 흐름 검토 및 개선 방안

**작성일:** 2025-10-15
**목적:** 현장점검 세션 관리의 문제점 분석 및 안전한 개선 방안 제시

---

## 📋 목차

1. [현재 시스템 분석](#1-현재-시스템-분석)
2. [발견된 문제점](#2-발견된-문제점)
3. [안전한 개선 방안](#3-안전한-개선-방안)
4. [구현하지 말아야 할 것](#4-구현하지-말아야-할-것)
5. [3단계 워크플로우 제안 검토](#5-3단계-워크플로우-제안-검토)

---

## 1. 현재 시스템 분석

### 1.1 세션 시작 시 처리

**파일:** `app/api/inspections/sessions/route.ts` (204-279행)

**동작:**
```typescript
// 1. 사용자별 active 세션 중복 체크
const { data: activeSession } = await supabase
  .from('inspection_sessions')
  .select('id')
  .eq('inspector_id', userId)
  .eq('status', 'active')
  .maybeSingle();

if (activeSession) {
  return NextResponse.json({
    error: '이미 진행 중인 점검 세션이 있습니다.',
    sessionId: activeSession.id,
  }, { status: 409 });
}

// 2. 새 세션 생성
.insert({
  equipment_serial: payload.equipmentSerial,
  inspector_id: userId,
  device_info: deviceSnapshot,
  original_snapshot: deviceSnapshot,
  current_snapshot: deviceSnapshot,
  refresh_status: 'idle',
})
```

**특징:**
- ✅ 동일 사용자가 여러 세션 동시 진행 방지
- ✅ 장비 정보 스냅샷 저장 (원본/현재/하위호환)
- ❌ **장비별 중복 점검 방지 없음**

### 1.2 진행 데이터 저장

**파일:** `lib/state/inspection-session-store.ts` (223-270행)

**동작:**
```typescript
async persistProgress(options) {
  const payload = {
    sessionId: session.id,
    currentStep,               // 현재 단계
    stepData,                  // 각 단계별 입력 데이터
    fieldChanges: session.field_changes || {},
  };

  // PATCH 요청으로 즉시 DB 저장
  await fetch(API_ENDPOINT, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
```

**특징:**
- ✅ 실시간 자동 저장
- ✅ 브라우저 종료 시에도 데이터 보존
- ✅ 진행 단계 및 모든 입력 데이터 저장

### 1.3 세션 복구

**파일:** `app/api/inspections/sessions/route.ts` (281-373행)

**동작:**
```typescript
// sessionId로 세션 조회
const { data } = await supabase
  .from('inspection_sessions')
  .select(SESSION_SELECT_FIELDS)
  .eq('id', sessionId)
  .maybeSingle();

// last_accessed_at 자동 업데이트
supabase
  .from('inspection_sessions')
  .update({ last_accessed_at: new Date().toISOString() })
  .eq('id', sessionId);

return NextResponse.json({
  session: { ...data },
  refreshing: needsRefresh,
});
```

**특징:**
- ✅ 세션 ID로 완전한 복구 가능
- ✅ 마지막 접근 시간 자동 기록
- ✅ 필요 시 장비 데이터 백그라운드 갱신

### 1.4 Assignment 시스템

**파일:** `app/api/inspections/assignments/route.ts` (174-195행)

**동작:**
```typescript
// 중복 할당 방지: 동일 장비 + 동일 점검원 체크
const { data: existing } = await supabase
  .from('inspection_assignments')
  .select('id, status, scheduled_date')
  .eq('equipment_serial', equipmentSerial)
  .eq('assigned_to', assignedTo)
  .in('status', ['pending', 'in_progress'])
  .maybeSingle();

if (existing) {
  return NextResponse.json({
    error: '이미 할당된 장비입니다.',
  }, { status: 409 });
}
```

**특징:**
- ✅ 동일 점검원에게 중복 할당 방지
- ⚠️ **다른 점검원에게는 중복 할당 가능** (의도된 설계)
- ✅ 점검 완료 시 assignment 상태 자동 업데이트 (sessions/route.ts 479-490행)

---

## 2. 발견된 문제점

### 🔴 심각: 장비별 중복 점검 방지 미흡

**문제 시나리오:**
```
1. 사용자 A가 장비 X 점검 시작
   → inspection_sessions (status: 'active')

2. 사용자 A가 중간에 나감
   → 세션은 여전히 'active' 상태

3. 사용자 B가 동일한 장비 X 점검 시작 가능
   → ❌ 두 명이 동시에 같은 장비 점검
```

**원인:**
- Sessions: 사용자별로만 중복 체크
- Assignments: 다른 사용자에게 중복 할당 허용
- **두 시스템 간 연동 부족**

### 🔴 심각: 세션 타임아웃 처리 없음

**문제:**
- 사용자가 점검을 시작하고 돌아오지 않으면
- 세션이 영구히 'active' 상태로 남음
- 해당 장비를 다른 사람도 점검할 수 없게 됨 (개선 후)

**현재 상태:**
- `last_accessed_at` 필드 존재하고 업데이트됨
- 하지만 만료 처리 로직 없음

### 🟡 개선 권장: 낙관적 잠금 부재

**문제:**
- 여러 브라우저 탭에서 동일 세션 접근 시
- 데이터 덮어쓰기 가능

---

## 3. 안전한 개선 방안

### ✅ 우선순위 1: Assignment-Session 연동 강화

**목적:** 할당된 장비만 점검 가능하도록 제한

**구현 위치:** `app/api/inspections/sessions/route.ts` POST 핸들러

**코드:**
```typescript
export const POST = async (request: NextRequest) => {
  const { supabase, userId } = await requireAuthWithRole();
  const payload = (await request.json()) as StartSessionPayload;

  // 기존: 사용자별 active 세션 체크 (유지)
  const { data: activeSession } = await supabase
    .from('inspection_sessions')
    .select('id')
    .eq('inspector_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (activeSession) {
    return NextResponse.json({
      error: '이미 진행 중인 점검 세션이 있습니다.',
      sessionId: activeSession.id,
    }, { status: 409 });
  }

  // 🆕 추가: 이 장비에 대한 assignment 확인
  const { data: assignment } = await supabase
    .from('inspection_assignments')
    .select('id, assigned_to, status')
    .eq('equipment_serial', payload.equipmentSerial)
    .eq('assigned_to', userId)
    .in('status', ['pending', 'in_progress'])
    .maybeSingle();

  // 🆕 추가: 할당되지 않은 장비는 점검 불가
  if (!assignment) {
    return NextResponse.json({
      error: '이 장비는 귀하에게 할당되지 않았습니다. 관리자에게 문의하세요.',
      code: 'NOT_ASSIGNED'
    }, { status: 403 });
  }

  // 🆕 추가: Assignment 상태를 'in_progress'로 업데이트
  if (assignment.status === 'pending') {
    await supabase
      .from('inspection_assignments')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', assignment.id);
  }

  // 기존 세션 생성 로직 계속...
};
```

**장점:**
- ✅ Assignment 시스템과 완전히 연동
- ✅ 할당되지 않은 장비 점검 방지
- ✅ Assignment 상태 자동 업데이트
- ✅ 기존 로직과 충돌 없음

**단점:**
- ⚠️ 자유롭게 점검하던 기존 방식 차단 (정책 결정 필요)

**위험도:** 낮음
**효과:** 높음

---

### ✅ 우선순위 2: 소프트 타임아웃 경고

**목적:** 장시간 미접근 세션에 대한 사용자 경고 (자동 처리 없음)

**구현 위치:** `app/api/inspections/sessions/route.ts` GET 핸들러

**코드:**
```typescript
export const GET = async (request: NextRequest) => {
  // ...기존 코드...

  if (sessionId) {
    const { data } = await supabase
      .from('inspection_sessions')
      .select(SESSION_SELECT_FIELDS)
      .eq('id', sessionId)
      .maybeSingle();

    // 🆕 추가: 장시간 미접근 경고
    const now = new Date();
    const lastAccess = new Date(data.last_accessed_at || data.started_at);
    const hoursSinceAccess = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60);

    let warning = null;
    if (hoursSinceAccess > 24 && data.status === 'active') {
      warning = {
        type: 'stale_session',
        message: '24시간 이상 접근하지 않은 세션입니다. 계속 진행하시겠습니까?',
        hoursSinceAccess: Math.floor(hoursSinceAccess),
        suggestAction: 'resume_or_cancel'
      };
    } else if (hoursSinceAccess > 4 && data.status === 'active') {
      warning = {
        type: 'inactive_session',
        message: '4시간 이상 접근하지 않았습니다. 점검을 계속 진행하세요.',
        hoursSinceAccess: Math.floor(hoursSinceAccess)
      };
    }

    // last_accessed_at 업데이트는 유지
    supabase
      .from('inspection_sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', sessionId)
      .then(() => console.log(`Last accessed updated for ${sessionId}`))
      .catch(err => console.error('Failed to update last_accessed:', err));

    return NextResponse.json({
      session: { ...data },
      warning, // 🆕 추가
      refreshing: needsRefresh,
      refreshStatus: data.refresh_status,
    });
  }
  // ...
};
```

**프론트엔드 처리:**
```typescript
const { session, warning } = await response.json();

if (warning) {
  if (warning.type === 'stale_session') {
    const confirmed = confirm(
      `${warning.message}\n\n` +
      `마지막 접근: ${warning.hoursSinceAccess}시간 전\n\n` +
      `"확인"을 누르면 계속 진행합니다.\n` +
      `"취소"를 누르면 세션을 종료합니다.`
    );

    if (!confirmed) {
      await cancelSession(session.id, '장시간 미접근으로 사용자가 취소');
      router.push('/dashboard');
      return;
    }
  } else {
    toast.warning(warning.message);
  }
}
```

**장점:**
- ✅ 사용자에게 선택권 제공
- ✅ 자동 상태 변경 없음 (Race Condition 없음)
- ✅ 기존 로직과 완전히 독립적

**단점:**
- ⚠️ 사용자가 무시하면 효과 없음

**위험도:** 매우 낮음
**효과:** 중간

---

### ✅ 우선순위 3: 관리자 대시보드 - 만료 세션 관리

**목적:** 관리자가 수동으로 장시간 미접근 세션 정리

**구현 위치:** `app/api/admin/stale-sessions/route.ts` (신규)

**코드:**
```typescript
// GET /api/admin/stale-sessions - 만료 세션 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 관리자 권한 확인
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!['master', 'ministry_admin', 'emergency_center_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 24시간 이상 미접근 세션 조회
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: staleSessions } = await supabase
    .from('inspection_sessions')
    .select(`
      id,
      equipment_serial,
      inspector_id,
      status,
      current_step,
      started_at,
      last_accessed_at,
      user_profiles!inspector_id(full_name, email)
    `)
    .eq('status', 'active')
    .lt('last_accessed_at', twentyFourHoursAgo)
    .order('last_accessed_at', { ascending: true });

  return NextResponse.json({
    staleSessions,
    count: staleSessions?.length || 0
  });
}

// POST /api/admin/cleanup-session - 세션 정리
export async function POST(request: NextRequest) {
  const { sessionId, action } = await request.json();
  // action: 'pause' | 'cancel'

  const supabase = await createClient();

  // 관리자 권한 확인...

  await supabase
    .from('inspection_sessions')
    .update({
      status: action === 'pause' ? 'paused' : 'cancelled',
      notes: `관리자에 의해 ${action === 'pause' ? '일시정지' : '취소'}됨 (장시간 미접근)`
    })
    .eq('id', sessionId);

  return NextResponse.json({ success: true });
}
```

**장점:**
- ✅ 사용자 경험에 영향 없음
- ✅ 관리자가 상황 판단 후 조치
- ✅ 안전한 정리 가능

**위험도:** 낮음
**효과:** 중간

---

## 4. 구현하지 말아야 할 것

### ❌ 즉시 자동 Paused 처리

**이유:**
```typescript
// ❌ 이런 코드를 작성하지 마세요
function autoExpireSessions() {
  const expired = sessions.filter(s =>
    hoursSince(s.last_accessed_at) > 24 && s.status === 'active'
  );

  expired.forEach(session => {
    // 자동으로 paused 처리
    updateSessionStatus(session.id, 'paused');
  });
}
```

**문제점:**
1. **Race Condition 위험**
   - 자동 paused 처리 중에 사용자가 접속하면?
   - 사용자는 'active'라고 생각하지만 서버는 'paused'로 변경
   - 데이터 동기화 문제 발생

2. **데이터 손실 가능성**
   - 점검원이 장시간 점검 중일 수 있음 (복잡한 수리 작업)
   - 자동으로 paused 되면 진행 중인 작업 방해

3. **사용자 경험 저하**
   - 사용자가 돌아왔을 때 갑자기 세션이 종료되어 있음
   - 혼란과 불만 발생

**대안:** 소프트 타임아웃 경고 (우선순위 2)

---

### ❌ 장비별 강제 단일 세션 (정책 미확인 시)

**이유:**
```typescript
// ❌ 정책 확인 전에는 이런 코드를 작성하지 마세요
const { data: anyActiveSession } = await supabase
  .from('inspection_sessions')
  .select('id, inspector_id')
  .eq('equipment_serial', equipmentSerial)
  .eq('status', 'active')
  .maybeSingle();

if (anyActiveSession) {
  return NextResponse.json({
    error: '이 장비는 다른 사용자가 점검 중입니다.',
  }, { status: 409 });
}
```

**문제점:**
1. **업무 흐름 파괴 가능성**
   - 현장에서 여러 명이 함께 점검하는 케이스가 있을 수 있음
   - 예: 선임 점검원이 신입을 교육하며 동시 점검
   - 예: 복잡한 장비에 대해 전문가가 함께 점검

2. **Assignment 시스템과 정책 충돌**
   - Assignments는 다른 점검원에게 중복 할당 허용
   - Sessions는 중복 세션 차단
   - **시스템 간 정책 불일치**

**대안:** Assignment-Session 연동 강화 (우선순위 1)
- 할당된 사용자만 점검 가능
- Assignment 정책과 일치

---

### ❌ 낙관적 잠금 (버전 필드 추가)

**이유:**
```typescript
// ❌ 현재 문제 해결에 과도한 복잡도
interface InspectionSession {
  // ...기존 필드...
  version: number; // 버전 필드 추가
}

// 업데이트 시 버전 체크
const { data, error } = await supabase
  .from('inspection_sessions')
  .update({
    step_data: mergedStepData,
    version: session.version + 1,
  })
  .eq('id', sessionId)
  .eq('version', session.version) // 버전 일치 확인
  .select();

if (!data) {
  throw new Error('세션이 다른 곳에서 수정되었습니다.');
}
```

**문제점:**
1. **스키마 변경 필요**
   - `inspection_sessions` 테이블에 `version` 컬럼 추가
   - 마이그레이션 작성 및 배포 필요

2. **기존 코드 전체 수정**
   - 모든 UPDATE 쿼리에 버전 체크 로직 추가
   - 에러 처리 로직 추가
   - 프론트엔드 재시도 로직 추가

3. **과도한 복잡도**
   - 현재 문제(중복 점검, 타임아웃)와 직접 관련 없음
   - 우선순위 낮음

**대안:** 나중에 필요하면 검토 (현재는 불필요)

---

## 5. 3단계 워크플로우 제안 검토

### 5.1 제안 내용

**현재 (2단계):**
```
일정추가(Assignment) → 점검완료(Completion)
```

**제안 (3단계):**
```
일정추가(Assignment) → 세션시작(Session Start) → 점검완료(Completion)
```

**UI 변경:**
```
현재: [목록] [지도] [점검완료] (3개 탭)
제안: [목록] [지도] [세션시작] [점검완료] (4개 탭)
```

**핵심 아이디어:**
- 세션이 시작된 장비는 목록/지도 탭에서 즉시 숨김
- 별도의 "세션시작" 탭에서만 표시
- 진행 중인 점검을 명확히 구분

### 5.2 장점 분석

#### ✅ 1. 명확한 상태 구분

**현재 문제:**
```
- 목록 탭: 할당된 장비 + 진행 중인 장비 혼재
- 사용자가 어떤 장비가 진행 중인지 구분 어려움
```

**제안 후:**
```
- 목록/지도 탭: 아직 시작 안 한 장비만
- 세션시작 탭: 진행 중인 장비만
- 점검완료 탭: 완료된 장비만
```

**효과:**
- 사용자가 현재 상태를 한눈에 파악 가능
- "어디까지 했더라?" 혼란 감소

#### ✅ 2. 중복 점검 방지 강화

**시각적 피드백:**
- 진행 중인 장비가 목록에서 사라짐
- 다른 점검원이 해당 장비를 선택할 수 없음
- UI 레벨에서 중복 방지

**백엔드와 시너지:**
- Assignment-Session 연동 강화 (우선순위 1)와 결합
- UI + Backend 이중 방어

#### ✅ 3. 진행률 관리 용이

**현재:**
- 대시보드에서 전체 통계만 확인 가능
- 개별 점검원의 진행 상황 파악 어려움

**제안 후:**
- "세션시작" 탭에서 진행 중인 장비 수 즉시 확인
- 관리자가 점검원별 진행 상황 모니터링 가능

#### ✅ 4. 재접속 시 편의성

**시나리오:**
```
점검원이 점검 중 전화를 받고 앱을 나감
→ 다시 돌아왔을 때 어디 있었는지 찾기 어려움
```

**제안 후:**
```
"세션시작" 탭으로 가면 바로 확인 가능
→ 클릭 한 번으로 재개
```

### 5.3 단점 및 우려사항

#### ⚠️ 1. UI 복잡도 증가

**추가 탭:**
- 3개 → 4개 탭
- 모바일 화면에서 탭이 많아짐
- 사용자 학습 곡선

**대안:**
- 목록 탭 내에서 필터로 구분 (진행 중 / 미진행)
- 하지만 제안의 핵심("즉시 숨김")을 달성하려면 별도 탭 필요

#### ⚠️ 2. 데이터 필터링 로직 추가

**구현 필요:**
```typescript
// 목록/지도 탭: 세션 없는 장비만
const unstarted = assignments.filter(a =>
  !activeSessions.some(s => s.equipment_serial === a.equipment_serial)
);

// 세션시작 탭: 세션 있는 장비만
const inProgress = assignments.filter(a =>
  activeSessions.some(s => s.equipment_serial === a.equipment_serial)
);
```

**성능 고려:**
- Assignment와 Session 조인 쿼리 필요
- 캐싱 전략 필요

#### ⚠️ 3. 기존 사용자 혼란

**현재 사용자:**
- 기존 3탭 구조에 익숙함
- 갑자기 4탭으로 변경 시 혼란

**완화 방안:**
- 릴리스 노트 작성
- 첫 로그인 시 안내 메시지
- 한 달간 "새로운 기능" 배지 표시

#### ⚠️ 4. 엣지 케이스 처리

**케이스 1: 세션 만료 후**
```
세션이 24시간 이상 미접근 → 어느 탭에 표시?
```

**해결:**
- 소프트 타임아웃 경고 후 사용자가 취소 선택 시
- "세션시작" 탭에서 제거
- 다시 "목록" 탭으로 복귀

**케이스 2: 오프라인 시작**
```
오프라인에서 점검 시작 → 동기화 전까지 어떻게 처리?
```

**해결:**
- 로컬 스토리지에 임시 저장
- "세션시작" 탭에 오프라인 배지 표시
- 온라인 복귀 시 자동 동기화

### 5.4 구현 복잡도 평가

#### Phase 1: Backend (중간 복잡도)

**1. Assignment-Session 상태 연동**
```typescript
// POST /api/inspections/sessions
// 세션 생성 시 assignment 상태를 'in_progress'로 업데이트
await supabase
  .from('inspection_assignments')
  .update({ status: 'in_progress' })
  .eq('equipment_serial', equipmentSerial)
  .eq('assigned_to', userId);
```

**2. 조회 API 수정**
```typescript
// GET /api/inspections/assignments
// 필터 파라미터 추가: with_session=true/false
if (withSession === 'false') {
  // 세션 없는 assignment만 반환
}
```

**복잡도:** ⭐⭐⭐ (3/5)

#### Phase 2: Frontend (높은 복잡도)

**1. AdminFullView 수정**
```typescript
const [viewMode, setViewMode] = useState<
  'list' | 'map' | 'in-progress' | 'completed'
>('list');

// 탭 추가
<button onClick={() => setViewMode('in-progress')}>
  세션시작
</button>
```

**2. 데이터 필터링**
```typescript
// 세션 정보 조회
const { data: sessions } = await fetch('/api/inspections/sessions');

// 필터링
const unstarted = assignments.filter(/*...*/);
const inProgress = assignments.filter(/*...*/);
```

**3. LocalFullView 수정**
- 모바일/데스크톱 양쪽 모두 수정 필요

**복잡도:** ⭐⭐⭐⭐ (4/5)

#### Phase 3: Testing (높은 복잡도)

**테스트 시나리오:**
1. 세션 시작 → 장비가 목록에서 사라지는지 확인
2. 세션 취소 → 장비가 목록으로 돌아오는지 확인
3. 세션 완료 → 점검완료 탭으로 이동하는지 확인
4. 다중 사용자 동시 접속 시나리오
5. 오프라인/온라인 전환 시나리오

**복잡도:** ⭐⭐⭐⭐ (4/5)

### 5.5 최종 권장사항

#### 🟢 권장: 단계별 접근

**Step 1: Backend 연동 먼저 (우선순위 1, 2)**
```
1. Assignment-Session 연동 강화 구현
2. 소프트 타임아웃 경고 구현
3. 충분히 테스트
```

**Step 2: UI 개선 검토**
```
1. 사용자 피드백 수집
   - 현재 UI에서 가장 불편한 점?
   - 진행 중인 장비 찾기 어려운가?

2. 피드백 기반으로 UI 개선 방향 결정
   - 4탭 구조 vs 필터 방식
   - A/B 테스트 고려
```

**Step 3: 점진적 배포**
```
1. 베타 사용자 그룹에 먼저 배포
2. 피드백 수집 및 개선
3. 전체 사용자에게 배포
```

#### 🟡 조건부 권장: 파일럿 테스트

**조건:**
- 현재 사용자가 "진행 중인 장비 찾기 어렵다"고 불만 제기
- 중복 점검 사례가 실제로 발생

**방법:**
1. 소규모 사용자 그룹(5-10명)에 4탭 UI 먼저 제공
2. 2주간 사용 후 설문조사
3. 긍정적 반응 → 전체 배포
4. 부정적 반응 → 다른 방법 모색

#### ❌ 비권장: 즉시 전체 배포

**이유:**
- 사용자 혼란 가능성
- 구현 복잡도 높음
- 롤백 어려움

---

## 6. 구현 우선순위 요약

### 즉시 구현 (1-2주)
1. ✅ **Assignment-Session 연동 강화**
   - 위험: 낮음
   - 효과: 높음
   - 복잡도: 중간

2. ✅ **소프트 타임아웃 경고**
   - 위험: 매우 낮음
   - 효과: 중간
   - 복잡도: 낮음

### 중기 구현 (1-2개월)
3. ✅ **관리자 대시보드 - 만료 세션 관리**
   - 위험: 낮음
   - 효과: 중간
   - 복잡도: 중간

4. 🟡 **3단계 워크플로우 (조건부)**
   - 위험: 중간
   - 효과: 높음 (사용자 피드백 필요)
   - 복잡도: 높음

### 장기 검토
5. 🔵 **낙관적 잠금 (필요 시)**
   - 위험: 중간
   - 효과: 중간
   - 복잡도: 높음

---

## 7. 다음 단계

1. **사용자 인터뷰 실시**
   - 현재 점검 업무 흐름의 불편한 점
   - 진행 중인 장비 찾기 어려운가?
   - 중복 점검 사례 발생 여부

2. **우선순위 1, 2 구현**
   - Assignment-Session 연동
   - 소프트 타임아웃 경고

3. **사용자 피드백 수집 후 3단계 워크플로우 결정**
   - 긍정적 → 파일럿 테스트
   - 부정적 → 대안 모색 (필터 방식 등)

---

**문서 버전:** 1.0
**마지막 업데이트:** 2025-10-15
