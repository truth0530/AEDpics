# NCP 자체 인증 시스템 전환 전략

**작성일**: 2025-10-25
**목적**: 국정원 인증 획득을 위한 완전한 국내 인증 시스템 구축

## 왜 Supabase Auth를 제거해야 하는가?

### 국정원 인증 요구사항
1. **데이터 주권**: 모든 사용자 인증 데이터가 한국 내 서버에 저장
2. **해외 서비스 금지**: 미국 서버(Supabase)를 통한 인증 불가
3. **완전한 제어권**: 인증 로직, 세션 관리, 토큰 발급 모두 자체 관리
4. **감사 로그**: 모든 인증 이벤트를 국내 서버에 기록

### 현재 Supabase Auth가 처리하는 것들
```
사용자 → Supabase Auth (미국 서버) → 인증 처리
              ↓
        세션 토큰 발급
              ↓
        PostgreSQL (Supabase)
```

### NCP 자체 인증으로 전환 후
```
사용자 → NCP Next.js API → 인증 처리 (한국)
              ↓
        세션 토큰 발급 (한국)
              ↓
        NCP PostgreSQL (한국)
```

## 구현 방안

### 방안 1: NextAuth.js + Prisma (권장)

**장점**:
- Next.js 공식 권장
- Prisma와 완벽 통합
- 국내 서버에서 완전히 처리
- 세션 관리 자동화
- 보안 검증됨

**구조**:
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // NCP PostgreSQL에서 사용자 조회
        const user = await prisma.userProfile.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.passwordHash) {
          return null
        }

        // 비밀번호 검증 (한국 서버에서 처리)
        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isValid) {
          return null
        }

        // 한국 서버에서 세션 발급
        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role
        }
      }
    })
  ],
  session: {
    strategy: "jwt", // JWT는 서버에서 발급
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

**Prisma 스키마 추가 필요**:
```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@schema("aedpics")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@schema("aedpics")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@schema("aedpics")
}
```

### 방안 2: 완전 자체 구현

**직접 구현 항목**:
1. 비밀번호 해싱 (bcrypt)
2. JWT 토큰 발급/검증
3. 세션 관리
4. CSRF 보호
5. Rate Limiting
6. OTP 발급/검증
7. 비밀번호 재설정

**예시 코드**:
```typescript
// app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  // 1. NCP PostgreSQL에서 사용자 조회
  const user = await prisma.userProfile.findUnique({
    where: { email }
  })

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { error: '이메일 또는 비밀번호가 일치하지 않습니다.' },
      { status: 401 }
    )
  }

  // 2. 비밀번호 검증 (한국 서버에서 처리)
  const isValid = await bcrypt.compare(password, user.passwordHash)

  if (!isValid) {
    return NextResponse.json(
      { error: '이메일 또는 비밀번호가 일치하지 않습니다.' },
      { status: 401 }
    )
  }

  // 3. JWT 토큰 발급 (한국 서버에서 처리)
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )

  // 4. 로그인 이력 기록 (NCP PostgreSQL)
  await prisma.loginHistory.create({
    data: {
      userId: user.id,
      loginMethod: 'PASSWORD',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      success: true
    }
  })

  // 5. HttpOnly 쿠키로 토큰 전달
  const response = NextResponse.json({ success: true, user })
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 // 7일
  })

  return response
}
```

## 마이그레이션 로드맵

### Phase 1: 준비 (1주)
1. NextAuth.js 설치
   ```bash
   npm install next-auth @next-auth/prisma-adapter bcryptjs
   npm install -D @types/bcryptjs
   ```

2. Prisma 스키마 업데이트
   - Account, Session, VerificationToken 모델 추가

3. 환경변수 추가
   ```env
   NEXTAUTH_URL=http://localhost:3001
   NEXTAUTH_SECRET=your-secret-key-here
   JWT_SECRET=another-secret-key
   ```

### Phase 2: 인증 시스템 구현 (1주)
1. NextAuth 설정
2. 로그인/로그아웃 API 구현
3. 세션 검증 미들웨어
4. 비밀번호 재설정 플로우

### Phase 3: 기존 코드 전환 (1주)
1. lib/supabase/client.ts 대체
2. useAuth 훅 수정
3. 보호된 라우트 업데이트
4. 관리자 페이지 전환

### Phase 4: 테스트 및 검증 (3일)
1. 로그인/로그아웃 테스트
2. 세션 관리 테스트
3. 보안 검증
4. 성능 테스트

### Phase 5: 배포 (2일)
1. NCP 환경 설정
2. 환경변수 구성
3. 데이터베이스 마이그레이션
4. 기존 사용자 비밀번호 마이그레이션

## 기존 Supabase 사용자 마이그레이션

**문제**: Supabase에 저장된 사용자의 비밀번호를 가져올 수 없음

**해결 방법**:
1. **임시 비밀번호 발급**
   - 모든 사용자에게 임시 비밀번호 이메일 발송
   - 첫 로그인 시 비밀번호 변경 강제

2. **비밀번호 재설정 링크**
   - 모든 사용자에게 재��정 링크 이메일 발송
   - 새로운 NCP 시스템에서 비밀번호 설정

## 국정원 인증 체크리스트

- [ ] 모든 인증 API가 NCP 서버에서 실행
- [ ] 사용자 데이터가 NCP PostgreSQL에 저장
- [ ] 세션/토큰이 NCP에서 발급
- [ ] 비밀번호 해싱이 NCP에서 처리
- [ ] 로그인 이력이 NCP에 기록
- [ ] 해외 서비스(Supabase) 완전 제거
- [ ] 데이터 주권 확보
- [ ] 감사 로그 시스템 구축

## 예상 비용 및 시간

### NextAuth.js 방식
- **개발 시간**: 2-3주
- **추가 비용**: 없음 (NCP 리소스 사용)
- **난이도**: 중
- **유지보수**: 쉬움

### 완전 자체 구현
- **개발 시간**: 4-6주
- **추가 비용**: 없음
- **난이도**: 상
- **유지보수**: 어려움

## 권장사항

**즉시**: NextAuth.js + Prisma 방식 채택
**이유**: 
1. Next.js 공식 권장
2. 빠른 구현 (2-3주)
3. 보안 검증됨
4. NCP에서 완전히 작동
5. 국정원 인증 요구사항 충족

---

**결론**: Supabase Auth를 NextAuth.js로 전환하면 국정원 인증 획득 가능
**예상 기간**: 2-3주
**핵심**: 모든 인증 로직을 NCP(한국) 서버에서 처리
