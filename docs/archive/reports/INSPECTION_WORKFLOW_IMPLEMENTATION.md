# 현장점검 업무 흐름 개선 구현 완료

**구현일:** 2025-10-15
**버전:** 1.0
**상태:** ✅ 완료

---

## 📋 구현된 기능

### ✅ 우선순위 1: Assignment-Session 연동 강화

**목적:** 할당된 장비만 점검 가능하도록 제한하여 무단 점검 방지

**구현 파일:** `app/api/inspections/sessions/route.ts` (233-272행)

**구현 내용:**

```typescript
// 🆕 Priority 1: Assignment 확인 및 연동
const { data: assignment } = await supabase
  .from('inspection_assignments')
  .select('id, assigned_to, status')
  .eq('equipment_serial', payload.equipmentSerial)
  .eq('assigned_to', userId)
  .in('status', ['pending', 'in_progress'])
  .maybeSingle();

// 할당되지 않은 장비는 점검 불가
if (!assignment) {
  console.log(`[Session Start] User ${userId} attempted to inspect unassigned equipment: ${payload.equipmentSerial}`);
  return NextResponse.json(
    {
      error: '이 장비는 귀하에게 할당되지 않았습니다. 관리자에게 문의하세요.',
      code: 'NOT_ASSIGNED'
    },
    { status: 403 },
  );
}

// Assignment 상태를 'in_progress'로 업데이트
if (assignment.status === 'pending') {
  const { error: updateError } = await supabase
    .from('inspection_assignments')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString()
    })
    .eq('id', assignment.id);

  if (updateError) {
    console.error('[Session Start] Failed to update assignment status:', updateError);
    // 에러가 발생해도 세션 생성은 계속 진행
  } else {
    console.log(`[Session Start] Assignment ${assignment.id} status updated to 'in_progress'`);
  }
}
```

**동작 흐름:**

```
1. 사용자가 "점검" 버튼 클릭
   ↓
2. POST /api/inspections/sessions 호출
   ↓
3. 이 장비가 사용자에게 할당되었는지 확인
   ├─ 할당 없음 → 403 Forbidden 반환
   └─ 할당 있음 → 계속 진행
   ↓
4. Assignment 상태를 'in_progress'로 업데이트
   ├─ status: 'pending' → 'in_progress'
   └─ started_at: 현재 시각 기록
   ↓
5. Inspection Session 생성
   ↓
6. 점검 진행
```

**효과:**
- ✅ 할당되지 않은 장비 점검 차단
- ✅ Assignment와 Session 상태 자동 연동
- ✅ 점검 시작 시각 자동 기록
- ✅ 기존 점검 완료 시 연동 유지 (route.ts 479-490행)

---

### ✅ 우선순위 2: 소프트 타임아웃 경고

**목적:** 장시간 미접근 세션에 대한 사용자 경고 제공 (자동 처리 없음)

**구현 파일:** `app/api/inspections/sessions/route.ts` (358-381행, 438행)

**구현 내용:**

```typescript
// 🆕 Priority 2: 소프트 타임아웃 경고 (자동 처리 없음)
const now = new Date();
const lastAccess = new Date(data.last_accessed_at || data.started_at);
const hoursSinceAccess = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60);

let warning = null;
if (hoursSinceAccess > 24 && data.status === 'active') {
  warning = {
    type: 'stale_session',
    message: '24시간 이상 접근하지 않은 세션입니다. 계속 진행하시겠습니까?',
    hoursSinceAccess: Math.floor(hoursSinceAccess),
    suggestAction: 'resume_or_cancel',
    severity: 'high'
  };
  console.warn(`[Session Warning] Stale session detected: ${sessionId}, ${hoursSinceAccess.toFixed(1)} hours since last access`);
} else if (hoursSinceAccess > 4 && data.status === 'active') {
  warning = {
    type: 'inactive_session',
    message: '4시간 이상 접근하지 않았습니다. 점검을 계속 진행하세요.',
    hoursSinceAccess: Math.floor(hoursSinceAccess),
    severity: 'medium'
  };
  console.info(`[Session Info] Inactive session: ${sessionId}, ${hoursSinceAccess.toFixed(1)} hours since last access`);
}

// API 응답에 warning 포함
return NextResponse.json({
  session: { ...data },
  refreshing: needsRefresh,
  refreshStatus: data.refresh_status,
  warning, // 🆕 타임아웃 경고 (null 또는 경고 객체)
});
```

**경고 레벨:**

| 미접근 시간 | 경고 타입 | 심각도 | 메시지 |
|------------|-----------|--------|--------|
| 4시간 이상 | `inactive_session` | medium | "4시간 이상 접근하지 않았습니다. 점검을 계속 진행하세요." |
| 24시간 이상 | `stale_session` | high | "24시간 이상 접근하지 않은 세션입니다. 계속 진행하시겠습니까?" |

**API 응답 형식:**

```json
{
  "session": { ...세션 데이터... },
  "refreshing": false,
  "refreshStatus": "idle",
  "warning": {
    "type": "stale_session",
    "message": "24시간 이상 접근하지 않은 세션입니다. 계속 진행하시겠습니까?",
    "hoursSinceAccess": 25,
    "suggestAction": "resume_or_cancel",
    "severity": "high"
  }
}
```

**프론트엔드 구현 예시:**

```typescript
// 세션 로드 시
const response = await fetch(`/api/inspections/sessions?sessionId=${id}`);
const { session, warning } = await response.json();

if (warning) {
  if (warning.type === 'stale_session') {
    // 24시간 이상: 사용자 확인 필요
    const confirmed = confirm(
      `${warning.message}\n\n` +
      `마지막 접근: ${warning.hoursSinceAccess}시간 전\n\n` +
      `"확인"을 누르면 계속 진행합니다.\n` +
      `"취소"를 누르면 세션을 종료합니다.`
    );

    if (!confirmed) {
      await cancelSession(session.id, '장시간 미접근으로 사용자가 취소');
      router.push('/inspection');
      return;
    }
  } else if (warning.type === 'inactive_session') {
    // 4시간 이상: 가벼운 경고만
    toast.warning(warning.message);
  }
}

// 세션 계속 진행...
```

**효과:**
- ✅ 사용자에게 선택권 제공
- ✅ 자동 상태 변경 없음 (Race Condition 방지)
- ✅ 서버 로그에 경고 기록 (모니터링 가능)
- ✅ 기존 로직과 완전히 독립적

---

## 🔄 전체 워크플로우

### 점검 시작 (Session Start)

```
[사용자] "점검" 버튼 클릭
    ↓
[Frontend] POST /api/inspections/sessions
    ↓
[Backend] 체크 1: 사용자별 active 세션 확인
    ├─ 있음 → 409 Conflict 반환
    └─ 없음 → 계속
    ↓
[Backend] 체크 2: 🆕 Assignment 확인
    ├─ 없음 → 403 Forbidden 반환
    └─ 있음 → 계속
    ↓
[Backend] 액션 1: 🆕 Assignment 상태 업데이트
    └─ 'pending' → 'in_progress'
    └─ started_at 기록
    ↓
[Backend] 액션 2: Session 생성
    └─ status: 'active'
    └─ equipment_serial 저장
    └─ device_info 스냅샷 저장
    ↓
[Frontend] 점검 페이지로 이동
```

### 세션 복구 (Session Resume)

```
[사용자] 점검 페이지 재접속
    ↓
[Frontend] GET /api/inspections/sessions?sessionId=xxx
    ↓
[Backend] 체크 1: 세션 존재 확인
    ├─ 없음 → 404 Not Found
    └─ 있음 → 계속
    ↓
[Backend] 체크 2: 권한 확인
    ├─ 다른 사용자 → 403 Forbidden
    └─ 본인 → 계속
    ↓
[Backend] 액션 1: last_accessed_at 업데이트 (비차단)
    ↓
[Backend] 액션 2: 🆕 타임아웃 체크
    ├─ 24시간 이상 → warning: 'stale_session'
    ├─ 4시간 이상 → warning: 'inactive_session'
    └─ 4시간 미만 → warning: null
    ↓
[Backend] 액션 3: 데이터 갱신 체크 (필요 시)
    ↓
[Backend] 응답 반환
    └─ session + warning
    ↓
[Frontend] 🆕 Warning 처리
    ├─ stale_session → confirm() 표시
    │   ├─ 확인 → 계속 진행
    │   └─ 취소 → cancelSession() 호출
    └─ inactive_session → toast.warning() 표시
    ↓
[Frontend] 점검 재개
```

### 점검 완료 (Session Complete)

```
[사용자] "점검 완료" 버튼 클릭
    ↓
[Frontend] PATCH /api/inspections/sessions
    └─ status: 'completed'
    ↓
[Backend] 액션 1: Session 완료 처리
    └─ status: 'active' → 'completed'
    └─ completed_at 기록
    ↓
[Backend] 액션 2: Assignment 완료 처리 (기존)
    └─ status: 'in_progress' → 'completed'
    └─ completed_at 기록
    ↓
[Backend] 액션 3: aed_data 업데이트 (기존)
    └─ last_inspection_date 업데이트
    └─ 기타 필드 업데이트
    ↓
[Frontend] 완료 페이지로 이동
```

---

## 📊 상태 전이 다이어그램

### Assignment 상태

```
[pending]
   ↓ 🆕 세션 시작 시 자동 업데이트
[in_progress]
   ↓ 점검 완료 시 자동 업데이트 (기존)
[completed]
```

### Session 상태

```
[active]
   ├─ (계속 진행) → [active]
   ├─ (일시 정지) → [paused]
   ├─ (완료) → [completed]
   └─ (취소) → [cancelled]

[paused]
   ├─ (재개) → [active]
   └─ (취소) → [cancelled]
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 정상 점검 흐름

```
1. 관리자가 사용자 A에게 장비 X 할당
   ✅ inspection_assignments (status: 'pending')

2. 사용자 A가 "점검" 버튼 클릭
   ✅ Assignment 확인 통과
   ✅ Assignment 상태: 'pending' → 'in_progress'
   ✅ Session 생성 (status: 'active')

3. 사용자 A가 점검 진행
   ✅ persistProgress() 자동 호출
   ✅ step_data 저장

4. 사용자 A가 점검 완료
   ✅ Session 상태: 'active' → 'completed'
   ✅ Assignment 상태: 'in_progress' → 'completed'
   ✅ aed_data 업데이트
```

### 시나리오 2: 할당되지 않은 장비 점검 시도

```
1. 사용자 B가 장비 X 점검 시도 (할당받지 않음)
   ✅ Assignment 확인 실패
   ✅ 403 Forbidden 반환
   ✅ 에러 메시지: "이 장비는 귀하에게 할당되지 않았습니다."
   ✅ Session 생성 안 됨
```

### 시나리오 3: 장시간 미접근 세션

```
1. 사용자 A가 점검 시작 후 25시간 경과
   ✅ Session은 여전히 'active' 상태

2. 사용자 A가 재접속
   ✅ GET /api/inspections/sessions 호출
   ✅ warning.type: 'stale_session' 반환
   ✅ Frontend에서 confirm() 표시

3-A. 사용자가 "확인" 선택
   ✅ 점검 재개

3-B. 사용자가 "취소" 선택
   ✅ cancelSession() 호출
   ✅ Session 상태: 'active' → 'cancelled'
   ✅ Assignment 상태는 유지 (다시 할당 가능)
```

### 시나리오 4: 중간 이탈 후 복귀

```
1. 사용자 A가 점검 중 전화 받음 (5시간 경과)
   ✅ Session은 'active' 상태 유지
   ✅ step_data 저장되어 있음

2. 사용자 A가 재접속
   ✅ GET /api/inspections/sessions 호출
   ✅ warning.type: 'inactive_session' 반환
   ✅ Frontend에서 toast.warning() 표시

3. 사용자가 점검 재개
   ✅ 마지막 단계부터 계속 진행
   ✅ 모든 입력 데이터 복구됨
```

---

## 📝 로그 예시

### 정상 점검 시작

```
[Session Start] Assignment found for user abc-123, equipment SN-001, assignment status: pending
[Session Start] Assignment def-456 status updated to 'in_progress'
Last accessed updated for session xyz-789
```

### 할당되지 않은 장비 점검 시도

```
[Session Start] User abc-123 attempted to inspect unassigned equipment: SN-002
```

### 장시간 미접근 세션 복구

```
[Session Warning] Stale session detected: xyz-789, 25.3 hours since last access
Last accessed updated for session xyz-789
```

### 일반 미접근 세션 복구

```
[Session Info] Inactive session: xyz-789, 5.7 hours since last access
Last accessed updated for session xyz-789
```

---

## 🚨 구현하지 않은 것 (의도적)

### ❌ 자동 Paused 처리

**이유:**
- Race Condition 위험
- 사용자가 돌아왔을 때 혼란
- 데이터 손실 가능성

**대신:**
- 소프트 경고로 사용자에게 선택권 제공
- 관리자 대시보드에서 수동 정리 (향후 구현)

### ❌ 장비별 강제 단일 세션

**이유:**
- 업무 흐름 파악 필요 (여러 명이 함께 점검 가능?)
- Assignment 시스템과 정책 충돌 가능

**대신:**
- Assignment 연동으로 할당된 사용자만 점검 가능
- Assignment 정책과 일치

### ❌ 낙관적 잠금 (버전 필드)

**이유:**
- 스키마 변경 필요
- 현재 문제와 직접 관련 없음
- 과도한 복잡도

**대신:**
- 나중에 필요 시 검토

---

## 📚 관련 문서

- [INSPECTION_WORKFLOW_REVIEW.md](./INSPECTION_WORKFLOW_REVIEW.md) - 검토 및 분석
- [INSPECTION_SYSTEM.md](../planning/INSPECTION_SYSTEM.md) - 전체 시스템 설계
- [inspection-architecture.md](../current/inspection-architecture.md) - 아키텍처

---

## 🔜 향후 작업

### 단기 (1-2주)
1. ✅ **프론트엔드 경고 처리 구현**
   - warning 객체 처리 로직
   - confirm() 및 toast.warning() 구현

2. **테스트 작성**
   - Assignment-Session 연동 테스트
   - 타임아웃 경고 테스트

### 중기 (1-2개월)
3. **관리자 대시보드 - 만료 세션 관리**
   - GET /api/admin/stale-sessions
   - POST /api/admin/cleanup-session

4. **3단계 워크플로우 검토** (조건부)
   - 사용자 인터뷰 실시
   - 피드백 기반 결정

---

**문서 버전:** 1.0
**마지막 업데이트:** 2025-10-15
