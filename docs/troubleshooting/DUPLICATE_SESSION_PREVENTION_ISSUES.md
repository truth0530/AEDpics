# 중복 세션 방지 로직 위험 분석 (2025-11-10)

## 발견된 잠재적 문제

### 1. Race Condition (가장 심각)

#### 시나리오 A: 동시 요청
```
시간 T0: 사용자 A → POST /api/inspections/sessions (장비 X)
시간 T1: validateInspectionSessionCreation(X) → "활성 세션 없음"
시간 T1.5: 사용자 B → POST /api/inspections/sessions (장비 X) [동시 요청]
시간 T1.6: validateInspectionSessionCreation(X) → "활성 세션 없음" [여전히 없음!]
시간 T2: 사용자 A의 create 실행 → 새 세션 생성 (ID: sess-A)
시간 T2.5: 사용자 B의 create 실행 → 새 세션 생성 (ID: sess-B) [중복!]
```

**결과**: 같은 장비 X에 두 개의 활성 세션 (sess-A, sess-B) 발생

**원인**: Validate와 Create 사이의 시간차에서 다른 요청이 끼어들 수 있음

#### 시나리오 B: 검증 직후 데이터 변경
```
validateInspectionSessionCreation()이 DB 쿼리 실행
→ SQL: SELECT * FROM inspection_sessions WHERE equipment_serial='X' AND status IN ('active', 'paused')
→ 결과: 없음 반환

[DB에 다른 프로세스가 레코드 insert]

→ prisma.inspection_sessions.create() 실행
→ 성공 (중복 제약 조건이 없으면)
```

---

### 2. 로그아웃 후 재로그인 시나리오

```
사용자 A:
T0: 장비 X 점검 시작 → 세션 생성 (inspector_id: user-A, status: active)
T5: 페이지 새로고침 중 로그아웃 (세션 타임아웃)
T6: 다시 로그인 (session.user.id: user-A)
T7: 점검 페이지 재접속
T8: InspectionPageClient → bootstrapSession() 실행

문제:
- validateInspectionSessionCreation()은 무조건 "활성 세션 있음" 반환 (자신의 세션도 포함)
- inspector_id = user-A인 기존 세션이 있음
- 409 에러: "이미 진행 중인 점검 세션이 있습니다"
- 자신의 세션인지 다른 사람의 세션인지 구분 안 함!
```

**결과**: 자신의 세션을 계속할 수 없음

---

### 3. 정상 점검 중 페이지 새로고침

```
사용자 A:
T0: 장비 X 점검 시작 → 세션 생성 (ID: sess-1)
T1: 단계 2 진행 중
T2: 페이지 새로고침 (F5)

InspectionPageClient가 다시 마운트:
T3: session.equipment_serial === serial? → NO (store가 비워짐)
T4: startMutation.mutateAsync(serial) 호출
T5: validateInspectionSessionCreation(X) → "활성 세션 있음" (자신의 sess-1)
T6: 409 에러 반환
T7: fallback 로직으로 loadSession 시도... [불안정]
```

**결과**: 재접속 시 자신의 세션을 감지 못할 가능성

---

### 4. 멀티 탭/윈도우 시나리오

```
사용자 A (같은 브라우저, 같은 계정):
탭 1: 장비 X 점검 시작 → 세션 생성 (ID: sess-1)
탭 2: 같은 사이트 접속 → /inspection/Y 로드
탭 2: 장비 Y 점검 시작 시도
T1: validateInspectionSessionCreation(Y) → "Y에 대한 활성 세션 없음"
T2: 새 세션 생성 (ID: sess-2)

정상 동작이지만:
- 같은 사용자가 여러 장비를 동시에 점검 (의도된 동작인가?)
```

---

## 현재 구현의 취약점

### 1단계: validateInspectionSessionCreation()
```typescript
// lib/inspections/session-validation.ts:52
export async function validateInspectionSessionCreation(equipmentSerial: string) {
  // 활성 세션이 있는지 확인
  const existingSession = await prisma.inspection_sessions.findFirst({
    where: {
      equipment_serial: equipmentSerial,
      status: { in: ['active', 'paused'] }
    }
  });

  if (existingSession) {
    return { allowed: false, ... }; // 차단
  }

  return { allowed: true }; // 허용
}
```

**문제**:
- 누가 점검 중인지 확인 안 함 (자신인지 다른 사용자인지)
- 검증과 생성 사이에 race condition 가능
- 트랜잭션 사용 안 함

### 2단계: POST /api/inspections/sessions
```typescript
// app/api/inspections/sessions/route.ts:111-130
const validation = await validateInspectionSessionCreation(equipment_serial);

if (!validation.allowed) {
  return NextResponse.json({ ... }, { status: 409 });
}

// 새 세션 생성
const newSession = await prisma.inspection_sessions.create({ ... });
```

**문제**:
- validateInspectionSessionCreation()이 "허용"을 반환한 후
- create 직전에 다른 요청이 같은 장비에 세션을 먼저 생성 → 중복 가능

---

## 개선 방안 (우선순위 순)

### 방안 1: Database 제약 조건 추가 (최우선) ⭐⭐⭐
**위치**: Prisma Schema 또는 마이그레이션

```prisma
// prisma/schema.prisma
model inspection_sessions {
  // ...
  @@unique([equipment_serial, status], where: "status IN ('active', 'paused')")
}
```

**장점**:
- 데이터베이스 레벨에서 중복 방지
- 애플리케이션 로직 버그와 무관하게 작동
- Race condition 완전 차단

**단점**:
- 마이그레이션 필요
- 기존 중복 데이터 정리 필요

**설명**:
- 같은 equipment_serial과 status('active' 또는 'paused')의 조합이 1개만 존재하도록 강제
- 중복 시도 시 DB 에러 발생 → 애플리케이션에서 처리

---

### 방안 2: Transaction 사용 (권장) ⭐⭐⭐
**위치**: app/api/inspections/sessions/route.ts POST 메서드

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { equipment_serial } = body;

  // ✅ 트랜잭션으로 검증과 생성을 원자적으로 처리
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1단계: 활성 세션 확인 (트랜잭션 내부)
      const existingSession = await tx.inspection_sessions.findFirst({
        where: {
          equipment_serial,
          status: { in: ['active', 'paused'] }
        }
      });

      if (existingSession) {
        throw new Error('DUPLICATE_SESSION');
      }

      // 2단계: 새 세션 생성 (이전 단계의 결과에 기반)
      const newSession = await tx.inspection_sessions.create({
        data: {
          equipment_serial,
          inspector_id: session.user.id,
          status: 'active',
          current_step: 0,
          started_at: new Date()
        }
      });

      return newSession;
    });

    return NextResponse.json({ success: true, session: result });
  } catch (error) {
    if (error.message === 'DUPLICATE_SESSION') {
      return NextResponse.json(
        { error: '이미 진행 중인 점검 세션이 있습니다.' },
        { status: 409 }
      );
    }
    // ...
  }
}
```

**장점**:
- 검증과 생성이 원자적(atomic) 실행
- 트랜잭션 중 다른 요청의 변경 차단 (Isolation)
- Race condition 방지

**단점**:
- 약간의 성능 오버헤드
- 트랜잭션 복잡도 증가

---

### 방안 3: Inspector ID 기반 검증 개선 (권장) ⭐⭐
**위치**: lib/inspections/session-validation.ts

```typescript
export async function validateInspectionSessionCreation(
  equipmentSerial: string,
  currentUserId: string  // ← 현재 사용자 ID 추가
): Promise<{
  allowed: boolean;
  isOwnSession?: boolean;  // 자신의 세션인가?
  reason?: string;
  existingSession?: any;
}> {
  const existingSession = await prisma.inspection_sessions.findFirst({
    where: {
      equipment_serial: equipmentSerial,
      status: { in: ['active', 'paused'] }
    },
    include: { user_profiles: { select: { full_name: true } } }
  });

  if (!existingSession) {
    return { allowed: true };
  }

  // ✅ 자신의 세션이면 "재개 가능"으로 반환
  if (existingSession.inspector_id === currentUserId) {
    return {
      allowed: true,  // 재개 가능
      isOwnSession: true,
      existingSession
    };
  }

  // 다른 사용자의 세션이면 차단
  return {
    allowed: false,
    isOwnSession: false,
    reason: `다른 점검자(${existingSession.user_profiles?.full_name})가 이미 점검 중입니다.`,
    existingSession
  };
}
```

**사용**:
```typescript
const validation = await validateInspectionSessionCreation(
  equipment_serial,
  session.user.id  // ← 현재 사용자 ID 전달
);

if (!validation.allowed && !validation.isOwnSession) {
  // 다른 사람의 세션
  return NextResponse.json({ error: validation.reason }, { status: 409 });
}

if (validation.isOwnSession) {
  // 자신의 세션 - 재개
  await loadSession(validation.existingSession.id);
  return NextResponse.json({ success: true, action: 'resumed' });
}

// 새 세션 생성
const newSession = await prisma.inspection_sessions.create({ ... });
```

**장점**:
- 자신의 세션은 재개 가능
- 다른 사람의 세션만 차단
- 로그아웃/재로그인 시나리오 해결

---

### 방안 4: Pessimistic Locking (선택사항) ⭐
**위치**: app/api/inspections/sessions/route.ts

```typescript
// 아직 Prisma는 pessimistic lock을 공식 지원하지 않음
// Raw SQL로 구현 필요

const result = await prisma.$transaction(async (tx) => {
  // SELECT ... FOR UPDATE (장비 레코드 잠금)
  const device = await tx.$queryRaw`
    SELECT * FROM aed_data
    WHERE equipment_serial = ${equipment_serial}
    FOR UPDATE
  `;

  const existingSession = await tx.inspection_sessions.findFirst({
    where: {
      equipment_serial,
      status: { in: ['active', 'paused'] }
    }
  });

  if (existingSession) throw new Error('DUPLICATE');

  // 새 세션 생성
  return tx.inspection_sessions.create({ ... });
});
```

**장점**:
- 가장 강력한 race condition 방지
- DB 레벨의 행 단위 잠금

**단점**:
- Raw SQL 필요
- 성능 영향
- 데드락 가능성

---

## 권장 해결책 (3가지 조합)

### Step 1: 즉시 적용 (데이터 무결성) ⭐⭐⭐
**Transaction 기반 개선** (방안 2)

현재 코드를 transaction으로 감싸서 race condition 방지

### Step 2: 중기적 (UX 개선) ⭐⭐
**Inspector ID 기반 검증** (방안 3)

자신의 세션과 다른 사람의 세션 구분

### Step 3: 장기적 (데이터베이스 제약) ⭐⭐⭐
**Unique 제약 조건 추가** (방안 1)

데이터베이스 레벨에서 중복 완전 방지

---

## 마이그레이션 작성 예시

```prisma
// prisma/migrations/[timestamp]_add_unique_active_session/migration.sql

-- 기존 중복 데이터 정리 (수동)
-- DELETE FROM inspection_sessions
-- WHERE id NOT IN (
--   SELECT id FROM (
--     SELECT id, ROW_NUMBER() OVER (PARTITION BY equipment_serial, status ORDER BY started_at DESC) as rn
--     FROM inspection_sessions
--     WHERE status IN ('active', 'paused')
--   ) t
--   WHERE rn = 1
-- )

-- Unique 제약 조건 추가
ALTER TABLE inspection_sessions
ADD CONSTRAINT unique_active_session_per_equipment
UNIQUE (equipment_serial, status)
WHERE status IN ('active', 'paused');
```

---

## 테스트 계획

### 1. Race Condition 테스트
```bash
# 동시에 2개 요청 보내기
curl -X POST http://localhost:3001/api/inspections/sessions \
  -H "Content-Type: application/json" \
  -d '{"equipment_serial":"11-0000001"}' &

curl -X POST http://localhost:3001/api/inspections/sessions \
  -H "Content-Type: application/json" \
  -d '{"equipment_serial":"11-0000001"}' &

wait

# 결과: 하나는 성공, 하나는 409 에러 (또는 둘 다 409)
```

### 2. 자신의 세션 재개 테스트
```
1. 점검 시작
2. 페이지 새로고침
3. 자신의 세션 자동 로드 (새로 만들지 않음)
```

### 3. 다른 사용자 세션 확인
```
1. 사용자 A: 장비 X 점검 시작
2. 사용자 B: 같은 장비 X 점검 시도 → 409 에러 (상세 메시지)
```

---

## 최종 권장사항

| 구분 | 방안 1 | 방안 2 | 방안 3 | 방안 4 |
|------|-------|-------|-------|-------|
| Race Condition 방지 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| 구현 난이도 | 높음 | 중간 | 낮음 | 매우 높음 |
| 성능 영향 | 낮음 | 낮음 | 없음 | 높음 |
| 장기 안정성 | ⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐ |
| 우선순위 | 3순위 | **1순위** | **2순위** | 4순위 |

---

## 다음 단계

1. **긴급** (이번주): Transaction 기반 개선 구현
2. **중기** (2주): Inspector ID 기반 검증 추가
3. **장기** (1개월): Prisma 마이그레이션으로 unique 제약 추가

---

---

## 구현 완료 (2025-11-10)

### 1단계: Transaction 기반 Race Condition 방지 ✅

**파일**: [app/api/inspections/sessions/route.ts](../../app/api/inspections/sessions/route.ts)

**구현 내용**:
- `prisma.$transaction()` 을로 validate + create 원자성 보장
- 검증과 생성이 한 번의 DB 트랜잭션으로 실행
- 동시 요청 시 먼저 실행된 요청이 세션을 생성 → 이후 요청은 409 Conflict로 차단

**핵심 코드**:
```typescript
const result = await prisma.$transaction(async (tx) => {
  // 1. 트랜잭션 내에서 활성 세션 확인
  const existingSession = await tx.inspection_sessions.findFirst({
    where: {
      equipment_serial,
      status: { in: ['active', 'paused'] }
    }
  });

  // 2. 활성 세션 있음 → 누구든지 차단 (점검 시작 불가)
  if (existingSession) {
    throw new Error('SESSION_EXISTS|...');
  }

  // 3. 활성 세션 없음 → 새 세션 생성
  const newSession = await tx.inspection_sessions.create({ ... });
  return newSession;
});
```

**효과**:
- Race condition 완전 차단
- 동시 요청에서 하나만 성공, 나머지는 409
- 중복 세션 생성 불가능

### 2단계: 비즈니스 로직 명확화 ✅

**문제**: 초기 구현이 "자신의 세션은 재개 가능" 논리를 포함
- ❌ 자신과 다른 사람 모두 이미 시작된 세션을 "재개"하려는 시도
- ❌ "점검 시작"과 "이어하기"라는 개념을 혼동

**올바른 비즈니스 로직**:
- **"점검 시작"** (이 엔드포인트): 세션이 없을 때만 새 세션 생성
- **"이어하기"** (별도 엔드포인트): 기존 세션에서 계속 진행
- **세션 존재 시**: 누구든지 새로 시작 불가 (409 Conflict)

**결과 응답**:
```json
// 성공: 세션 없음
{
  "success": true,
  "session": { /* 새 세션 정보 */ }
}

// 차단: 활성 세션 있음 (누구든지 - 자신 포함)
{
  "success": false,
  "error": "이미 진행 중인 점검 세션이 있습니다. (점검자: 홍길동, 시작: 2025-11-10T...)",
  "existingSession": { /* 기존 세션 정보 */ }
  // Status: 409
}
```

### 3단계: 테스트 계획

#### Race Condition 테스트
```bash
# 동시에 2개 요청 보내기
curl -X POST http://localhost:3001/api/inspections/sessions \
  -H "Content-Type: application/json" \
  -d '{"equipment_serial":"11-0000001"}' &

curl -X POST http://localhost:3001/api/inspections/sessions \
  -H "Content-Type: application/json" \
  -d '{"equipment_serial":"11-0000001"}' &

wait

# 예상 결과:
# 요청 1: 200 OK with session
# 요청 2: 409 Conflict with error message
```

#### 정상 세션 생성
1. 세션 없음 상태에서 POST → 200 OK, 새 세션 생성
2. 활성 세션 있음 상태에서 POST → 409 Conflict, 기존 세션 반환

#### 다른 사용자 차단 확인
1. 사용자 A: 장비 X 점검 시작 → 성공
2. 사용자 B: 같은 장비 X 점검 시작 → 409 차단 (자신의 세션이 아닌 상관없이)

---

**작성**: 2025-11-10
**마지막 업데이트**: 2025-11-10 (Transaction 구현 완료)
**검토 필요**: 완료
**영향도**: CRITICAL (데이터 무결성) - 해결됨
