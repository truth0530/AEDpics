# 보안 서약서 통합 가이드

## 개요
임시점검원(temporary_inspector) 역할 사용자가 시스템 사용 전 보안 서약서에 동의하도록 하는 기능의 통합 가이드입니다.

## 현재 구현 상태

### ✅ 완료된 부분
- SecurityPledge UI 컴포넌트 (`/components/security/SecurityPledge.tsx`)
- 보안 서약서 페이지 (`/app/security-pledge/page.tsx`) - 테스트 가능
- API 엔드포인트 (`/api/security-pledge/route.ts`)
- 데이터베이스 테이블 (`security_pledges`)
- 전자서명 기능 (SignatureCanvas)

### ❌ 미구현 부분
- 회원가입/로그인 플로우 통합
- 도메인 기반 조건부 표시
- Middleware 레벨 서약서 체크

## 구현 방안

### 1. NextAuth 콜백 수정
`lib/auth/auth-options.ts`의 jwt 콜백에 서약서 체크 추가:

```typescript
callbacks: {
  async jwt({ token, user, trigger }) {
    if (user) {
      token.id = user.id;
      token.role = user.role;
      token.email = user.email;

      // 임시점검원 서약서 체크
      if (user.role === 'temporary_inspector') {
        const pledge = await prisma.security_pledges.findFirst({
          where: {
            user_id: user.id,
            pledge_type: 'temporary_inspector_pledge'
          }
        });
        token.hasPledge = !!pledge;
      }
    }

    // 서약서 작성 후 토큰 업데이트
    if (trigger === 'update' && token.id) {
      const pledge = await prisma.security_pledges.findFirst({
        where: {
          user_id: token.id as string,
          pledge_type: 'temporary_inspector_pledge'
        }
      });
      token.hasPledge = !!pledge;
    }

    return token;
  }
}
```

### 2. Middleware 수정
`middleware.ts`에 서약서 체크 로직 추가:

```typescript
import { needsSecurityPledge, isProtectedFromPledge } from '@/lib/middleware/security-pledge-check';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ... 기존 코드 ...

  // 임시점검원 서약서 체크
  if (userRole === 'temporary_inspector' && !isProtectedFromPledge(pathname)) {
    const needsPledge = await needsSecurityPledge(request);
    if (needsPledge) {
      const pledgeUrl = new URL('/security-pledge', request.url);
      pledgeUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(pledgeUrl);
    }
  }

  // ... 기존 코드 ...
}
```

### 3. 회원가입 완료 후 처리
회원가입 성공 후 역할에 따른 리다이렉트:

```typescript
// app/auth/signup/page.tsx - handleSignUpComplete 함수
const handleSignUpComplete = async () => {
  // ... 회원가입 처리 ...

  if (response.ok) {
    const data = await response.json();

    // 도메인 기반 분기
    if (isPublicEmailDomain(email)) {
      // 공공기관: 승인 대기 페이지로
      router.push('/pending-approval');
    } else {
      // 임시점검원: 서약서 페이지로
      router.push('/security-pledge');
    }
  }
};
```

### 4. 로그인 후 처리
로그인 페이지에서 서약서 체크:

```typescript
// app/auth/signin/page.tsx
const handleSignIn = async () => {
  const result = await signIn('credentials', {
    redirect: false,
    email,
    password,
  });

  if (result?.ok) {
    const session = await getSession();

    // 임시점검원이고 서약서 미작성인 경우
    if (session?.user?.role === 'temporary_inspector' && !session?.user?.hasPledge) {
      router.push('/security-pledge');
    } else {
      router.push(callbackUrl || '/dashboard');
    }
  }
};
```

### 5. SecurityPledge 컴포넌트 개선 사항

#### 도메인 체크 추가
```typescript
useEffect(() => {
  // 공공기관 도메인 사용자는 접근 불가
  if (session?.user?.email && isPublicEmailDomain(session.user.email)) {
    router.replace('/dashboard');
  }
}, [session, router]);
```

#### 서약서 제출 후 토큰 업데이트
```typescript
const handleSubmit = async () => {
  // ... 서약서 제출 ...

  if (response.ok) {
    // NextAuth 세션 업데이트
    await update({ hasPledge: true });

    // 원래 가려던 페이지로 리다이렉트
    const from = searchParams.get('from');
    router.push(from || '/inspection');
  }
};
```

## 테스트 시나리오

### 1. 임시점검원 신규 가입
1. gmail.com 등 일반 도메인으로 회원가입
2. 회원가입 완료 후 자동으로 `/security-pledge`로 리다이렉트
3. 서약서 동의 및 서명
4. `/inspection` 또는 `/dashboard`로 이동

### 2. 임시점검원 재로그인
1. 서약서 작성한 계정으로 로그인
2. 바로 `/dashboard`로 이동 (서약서 페이지 건너뜀)

### 3. 공공기관 사용자
1. korea.kr 또는 nmc.or.kr 도메인으로 가입/로그인
2. 서약서 페이지 표시되지 않음
3. 바로 승인 대기 또는 대시보드로 이동

### 4. 서약서 미작성 임시점검원
1. 보호된 페이지 접근 시도
2. 자동으로 `/security-pledge`로 리다이렉트
3. 서약 완료 후 원래 페이지로 복귀

## 보안 고려사항

1. **서약 정보 위변조 방지**
   - 서명 데이터를 Base64 이미지로 저장
   - IP 주소 및 User Agent 기록
   - 타임스탬프 포함

2. **중복 서약 방지**
   - DB 레벨에서 unique 제약
   - API 레벨에서 409 응답

3. **권한 우회 방지**
   - Middleware에서 강제 체크
   - 토큰에 서약 상태 포함

## 데이터베이스 스키마
```sql
-- 이미 존재하는 테이블
CREATE TABLE security_pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  pledge_type VARCHAR(50) NOT NULL,
  agreed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  signature_data TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_security_pledges_user ON security_pledges(user_id);
CREATE INDEX idx_security_pledges_type ON security_pledges(pledge_type);
```

## 향후 개선 사항

1. **서약서 버전 관리**
   - 약관 변경 시 재동의 요구
   - 버전별 서약 이력 관리

2. **서약서 만료 기능**
   - 1년 후 자동 만료
   - 재서약 알림

3. **관리자 대시보드**
   - 서약 현황 통계
   - 미서약자 관리

4. **PDF 다운로드**
   - 서명된 서약서 PDF 생성
   - 이메일 발송

## 참고 자료
- [보안 서약서 컴포넌트](/components/security/SecurityPledge.tsx)
- [API 엔드포인트](/app/api/security-pledge/route.ts)
- [미들웨어 체크 함수](/lib/middleware/security-pledge-check.ts)