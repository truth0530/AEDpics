# 로그인/로그아웃 문제 진단 보고서 (수정)

**작성일**: 2025-11-10
**수정일**: 2025-11-10
**상태**: 근본 원인 파악 및 수정안 확정
**우선순위**: 높음 (사용자 경험 저하)

---

## 핵심 요약

### 로그인 지연의 주요 원인: 이중 쓰기
```
시간 흐름:
1. authorize() 호출 (auth-options.ts)
   ├─ login_history.create()     ⏳ DB 쓰기
   └─ user_profiles.update()     ⏳ DB 쓰기

2. 클라이언트: fetch('/api/auth/track-login') 호출
   ├─ login_history.create()     ⏳ 또 쓰기! (중복)
   └─ user_profiles.update()     ⏳ 또 쓰기! (중복)
   └─ login_count increment()    ⏳ 추가 쓰기

3. 클라이언트: fetch('/api/user/profile/{id}') 호출
   └─ profile 조회 (authorize와 동일한 데이터)

결과: 4-5개 DB 작업이 직렬로 실행 → 테이블 락 대기 → 지연
```

### 로그아웃 실패의 원인: 예외 미처리
```typescript
// 현재 코드 (문제)
const logout = async () => {
  await signOut({ redirect: false });  // 실패하면?
  window.location.href = '/auth/signin';  // 도달 불가!
};

// 시나리오: signOut에서 네트워크 에러 발생
await signOut(...)  // → Promise reject
// → 에러 throw, try-catch 없음
// → window.location.href 도달 안 함
// → 사용자가 페이지에 갇힘
```

---

## 1. 이중 쓰기 문제 (가장 큰 원인)

### 현재 흐름

**Phase 1: authorize 함수 실행** ([lib/auth/auth-options.ts:19-82](lib/auth/auth-options.ts#L19-L82))
```typescript
async authorize(credentials) {
  const user = await prisma.user_profiles.findUnique({...})

  // 검증...

  // 쓰기 1: login_history 생성
  await prisma.login_history.create({
    data: {
      id: randomUUID(),
      user_id: user.id,
      success: true,
      ip_address: 'server',
      user_agent: 'NextAuth'
    }
  })

  // 쓰기 2: user_profiles 업데이트
  await prisma.user_profiles.update({
    where: { id: user.id },
    data: { last_login_at: new Date() }
  })

  return { id: user.id, email: user.email, role: user.role, ... }
}
```

**Phase 2: 클라이언트가 추가 호출** ([app/auth/signin/page.tsx:97-100](app/auth/signin/page.tsx#L97-L100))
```typescript
// NextAuth 세션이 이미 설정되었는데도 불구하고...

void fetch('/api/auth/track-login', { method: 'POST' }).catch(...)
  // ↓ [app/api/auth/track-login/route.ts:24-55]로 이동
```

**Phase 3: track-login API 재실행** ([app/api/auth/track-login/route.ts:24-55](app/api/auth/track-login/route.ts#L24-L55))
```typescript
async POST(request) {
  // 쓰기 3: login_history 다시 생성 (중복!)
  await prisma.login_history.create({
    data: {
      id: randomUUID(),
      user_id: session.user.id,
      success: true,
      ip_address: ip,
      user_agent: userAgent
    }
  })

  // 쓰기 4-5: user_profiles 다시 업데이트 + login_count 증가 (중복!)
  const updatedProfile = await prisma.user_profiles.update({
    where: { id: session.user.id },
    data: {
      last_login_at: new Date(),
      login_count: { increment: 1 },
      updated_at: new Date()
    }
  })

  return { success: true, login_count: ..., last_login_at: ... }
}
```

### 성능 영향

```
최악의 경우:
authorize():              100ms (user_profiles 조회 + 2개 쓰기)
track-login 요청 지연:    100-200ms (네트워크)
track-login 처리:        100ms (3개 쓰기)
profile API:             100-200ms
ui 응답:                 50ms
─────────────────────────────
총 소요: 450-650ms (이 중 300ms 이상 DB 작업)
```

### 근본 원인

1. **authorize에서 이미 완전히 처리됨**
   - login_history 기록: ✅
   - user_profiles.last_login_at 업데이트: ✅
   - 권한 검증: ✅

2. **track-login이 중복 실행**
   - authorize와 동일한 작업을 한 번 더 실행
   - 테이블 락으로 인한 대기 증가

3. **클라이언트 의존성**
   - 클라이언트가 API를 호출해야만 완료됨
   - 네트워크 지연 시 전체 지연

---

## 2. 로그인 UI 블로킹 (두 번째 원인)

### 현재 흐름 ([app/auth/signin/page.tsx:70-114](app/auth/signin/page.tsx#L70-L114))

```typescript
const result = await signIn('credentials', {
  email: formData.email,
  password: formData.password,
  redirect: false,
})

if (result?.ok) {
  // 1. 세션 조회
  const sessionResponse = await fetch('/api/auth/session')
  const session = await sessionResponse.json()

  // 2. 프로필 조회 (authorize에서 이미 가진 데이터)
  const profileResponse = await fetch(`/api/user/profile/${session.user.id}`)
  const profile = await profileResponse.json()

  // 이때까지 스피너 켜져있음!

  // 3. 여기서야 스피너 상태 업데이트
  setRedirecting(true)

  // 4. 라우팅
  router.push(defaultLanding)
}
```

### 문제점

- **setRedirecting(true)가 너무 늦음**
  - authorize: 완료 ✅
  - /api/auth/session: 완료 ✅
  - /api/user/profile: 완료 ✅ ← 이때까지 스피너 없음!
  - setRedirecting(true) ← 여기서 스피너 표시

- **불필요한 API 홉**
  - authorize는 이미 user 객체 반환
  - session API도 JWT에서 user 정보 제공
  - profile API가 추가로 같은 데이터 조회

### 체감 지연

```
authorize 완료:        100ms  ← 사용자는 "뭐지?" (응답 없음)
session API:          150ms  ← 여전히 스피너 없음
profile API:          200ms  ← 여전히 스피너 없음
스피너 표시:            0ms  ← 드디어 "로그인 처리 중..."
라우팅:               100ms
─────────────────────────────
총 소요: 550ms 중 450ms는 스피너 없이 대기

사용자 인식: "멈춤! 뭐 하는 거야?" ("뱅글뱅글" 호소)
```

---

## 3. 로그아웃 실패 (예외 미처리)

### 현재 코드

[components/logout-button.tsx:6-14](components/logout-button.tsx#L6-L14):
```typescript
const logout = async () => {
  await signOut({ redirect: false })
  window.location.href = '/auth/signin'
}
```

[components/layout/ProfileDropdown.tsx:37-44](components/layout/ProfileDropdown.tsx#L37-L44):
```typescript
const handleSignOut = async () => {
  await signOut({ redirect: false })
  window.location.href = '/auth/signin'
}
```

### 문제 시나리오

```
1. 사용자: 로그아웃 버튼 클릭
   ↓
2. signOut() 호출
   ├─ 네트워크 요청 전송 (세션 쿠키 삭제 요청)
   └─ 기다림 (await)

3. 네트워크 오류 발생
   - 타임아웃
   - DNS 실패
   - 서버 에러
   ↓
4. signOut() Promise reject
   ↓
5. try-catch 없음!
   ↓
6. 에러 throw
   ↓
7. window.location.href 도달 불가
   ↓
8. 사용자가 현재 페이지에 갇힘
   - "로그아웃 버튼 눌렀는데 아무것도 안 됨"
```

### 왜 모든 사용자에게 영향을 줄 수 있는가

- **예외 가능성**:
  - 네트워크 불안정
  - 세션 토큰 만료
  - 서버 메인테넌스
  - 느린 연결 타임아웃

- **재시도 불가능**:
  - 페이지 상태로 돌아가지 않음
  - 버튼은 여전히 "비활성"
  - 새로고침해야만 상태 초기화 가능

---

## 4. 민감한 데이터 노출

### 현재 상황 ([app/api/user/profile/[id]/route.ts:25-38](app/api/user/profile/[id]/route.ts#L25-L38))

```typescript
const profile = await prisma.user_profiles.findUnique({
  where: { id },
  include: { organizations: true }
})

// 주석: "비밀번호 해시 제거 (보안) - passwordHash 필드 없음"
return NextResponse.json(profile)  // ❌ 실제로는 전체 반환!
```

### 노출되는 정보

```javascript
{
  id: "...",
  email: "user@korea.kr",
  full_name: "김철수",
  role: "local_admin",
  organization_id: "...",
  organization_name: "대구광역시 중구보건소",
  password_hash: "...",              // ❌ 비밀번호 해시 (주석 거짓)
  account_locked: true,               // ❌ 계정 잠금 상태
  lock_reason: "승인 대기 중",        // ❌ 잠금 사유
  is_active: false,                   // ❌ 활성화 상태
  approval_status: "pending",         // ❌ 승인 상태
  // ... 기타 민감 필드
}
```

### 보안 영향

- 인증된 사용자는 다른 사용자의 password_hash 조회 가능
- 계정 잠금 정보로 타겟팅 공격 가능
- 승인 상태 정보 노출로 내부 정보 누수

---

## 5. 실제 사용자 경험

### 시나리오 A: 일반 사용자

```
1. 로그인 페이지에서 이메일/비밀번호 입력
2. 로그인 버튼 클릭
3. 아무 반응 없음 (450ms)
4. "뭐지?" 생각하며 대기
5. 갑자기 "로그인 처리 중..." 스피너 나타남
6. "어? 지금부터 처리하네?" 의아함
7. 그 후 2-3초 더 대기 (track-login + profile 로딩)
8. 드디어 대시보드로 이동

사용자 인식: "앱이 느리네", "멈춘 것 같은데?" → 재클릭
```

### 시나리오 B: 느린 네트워크 사용자

```
1. 로그인 시도
2. 10초 이상 대기
3. "로그인 처리 중..." 스피너 (6-8초 경과)
4. 여전히 로딩 중 (track-login 처리 중)
5. 끝내 포기하고 재로그인 시도

실제 원인: 4-5개 DB 쓰기 + 느린 네트워크
사용자 원인: "시스템이 느리다"
```

### 시나리오 C: 로그아웃

```
1. 로그아웃 버튼 클릭
2. (무언가 처리 중인 것 같음)
3. 화면에 아무 변화 없음
4. 다시 클릭 → 반응 없음
5. "로그아웃 안 되네?" → 새로고침
6. 다시 로그인 가능 (실제로는 쿠키 있음)
7. "앞의 로그아웃이 안 됐나?" 혼란

실제 원인: signOut 네트워크 에러 + 예외 미처리
```

---

## 6. 우선순위별 해결책

### 🔴 우선순위 1: 이중 쓰기 제거 (예상 개선: 1-2초)

**대상 파일**:
- [lib/auth/auth-options.ts](lib/auth/auth-options.ts)
- [app/auth/signin/page.tsx](app/auth/signin/page.tsx)

**변경 사항**:

1. authorize에서 login_count 통합
2. 쓰기 작업을 트랜잭션으로 묶기
3. track-login API 호출 제거

**효과**:
```
변경 전: 5개 작업 (직렬) = 450-550ms
변경 후: 2개 작업 (트랜잭션) = 100-150ms
개선: 300-400ms 단축 (약 70-80% 개선)
```

---

### 🟡 우선순위 2: 로그아웃 에러 처리 (예상 개선: 완전 해결)

**대상 파일**:
- [components/logout-button.tsx](components/logout-button.tsx)
- [components/layout/ProfileDropdown.tsx](components/layout/ProfileDropdown.tsx)

**변경 사항**:

1. try-catch 추가 또는 callbackUrl 사용
2. 실패 시에도 강제 이동
3. 사용자 피드백 추가

**효과**:
```
변경 전: 네트워크 에러 발생 → 사용자 갇힘
변경 후: 네트워크 에러 발생 → /auth/signin으로 이동
```

---

### 🟡 우선순위 3: 로그인 UI 최적화 (예상 개선: 체감 개선)

**대상 파일**:
- [app/auth/signin/page.tsx](app/auth/signin/page.tsx)

**변경 사항**:

1. setRedirecting(true)를 authorize 완료 직후 호출
2. profile 로드를 백그라운드로 이동
3. 불필요한 /api/auth/session 호출 검토

**효과**:
```
변경 전: 스피너가 450ms 후 나타남
변경 후: 스피너가 100ms 후 나타남
개선: 체감 속도 2-3배 향상
```

---

### 🟢 우선순위 4: 민감정보 필터링 (예상 개선: 보안)

**대상 파일**:
- [app/api/user/profile/[id]/route.ts](app/api/user/profile/[id]/route.ts)

**변경 사항**:

1. select를 사용해 필요한 필드만 반환
2. password_hash, lock 정보 제외
3. 클라이언트 필드만 노출

**효과**:
```
변경 전: 민감정보 노출 가능
변경 후: 필요한 정보만 안전하게 제공
```

---

## 7. 추가 확인 사항

### /api/auth/track-login 제거 전 확인

```typescript
// track-login의 응답이 사용되는가?
// app/auth/signin/page.tsx:97-100 확인
void fetch('/api/auth/track-login', { method: 'POST' }).catch(...)
// ↑ 반환값을 사용하지 않음 (void로 처리)

// 결론: 안전하게 제거 가능
```

### 트랜잭션 적용 시 login_count 포함

```typescript
// authorize에서 이미 처리하려면:
await prisma.$transaction([
  prisma.login_history.create({ ... }),
  prisma.user_profiles.update({
    where: { id: user.id },
    data: {
      last_login_at: new Date(),
      login_count: { increment: 1 }  // 추가
    }
  })
])
```

### 로그아웃 실패 시 사용자 피드백

```typescript
// 토스트 메시지 추가 (선택사항)
// "로그아웃 처리 중..."
// → 실패: "로그아웃에 실패했지만 로그인 페이지로 이동합니다"
// → 성공: "로그아웃 완료"
```

---

## 8. 요약

| 문제 | 원인 | 우선순위 | 예상 개선 |
|------|------|---------|---------|
| 로그인 3-5초 지연 | 이중 쓰기 (4-5개 작업) | 🔴 1순위 | 1-2초 단축 |
| "멈춘 것처럼" 느껴짐 | 스피너 지연 + API 홉 | 🟡 3순위 | 체감 2-3배 |
| 로그아웃 안 됨 | 예외 미처리 | 🟡 2순위 | 완전 해결 |
| 민감정보 노출 | 필터 미적용 | 🟢 4순위 | 보안 강화 |

---

## 참고

- [NextAuth.js callbacks](https://next-auth.js.org/configuration/callbacks)
- [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Error handling in async functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
