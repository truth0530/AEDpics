# NextAuth.js 마이그레이션 실행 계획

**작성일**: 2025-10-25
**목적**: Supabase Auth에서 NextAuth.js로 완전 전환
**예상 소요 시간**: 2-3주

## 현재 상태

- ✅ NextAuth.js 설치 완료
- ✅ bcryptjs, jsonwebtoken 설치 완료
- ⏸️ Prisma 스키마 업데이트 필요
- ⏸️ API 라우트 생성 필요

## 작업 단계

### Phase 1: 인프라 준비 (1-2일)

#### 1.1 Prisma 스키마 수정
**파일**: `prisma/schema.prisma`

추가할 내용:
1. UserProfile 모델에 passwordHash 필드 추가
2. NextAuth 필수 모델 추가:
   - Account
   - Session  
   - VerificationToken

```prisma
model UserProfile {
  // 기존 필드들...
  passwordHash  String?  @map("password_hash")  // 추가
  
  // NextAuth 관계
  accounts      Account[]
  sessions      Session[]
}

model Account {
  id                String  @id @default(uuid()) @db.Uuid
  userId            String  @map("user_id") @db.Uuid
  type              String
  provider          String
  providerAccountId String  @map("provider_account_id")
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
  @@schema("aedpics")
}

model Session {
  id           String   @id @default(uuid()) @db.Uuid
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id") @db.Uuid
  expires      DateTime

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
  @@schema("aedpics")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
  @@schema("aedpics")
}
```

#### 1.2 데이터베이스 마이그레이션
```bash
npx prisma db push
npx prisma generate
```

#### 1.3 환경변수 추가
`.env.local`에 추가:
```env
# NextAuth
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=generate-a-random-secret-key-here
JWT_SECRET=another-random-secret-key
```

### Phase 2: NextAuth 설정 (1일)

#### 2.1 NextAuth API 라우트 생성
**파일**: `app/api/auth/[...nextauth]/route.ts`

```typescript
import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("이메일과 비밀번호를 입력해주세요")
        }

        const user = await prisma.userProfile.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.passwordHash) {
          throw new Error("이메일 또는 비밀번호가 일치하지 않습니다")
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isValid) {
          throw new Error("이메일 또는 비밀번호가 일치하지 않습니다")
        }

        if (!user.isActive) {
          throw new Error("계정이 비활성화되었습니다")
        }

        if (user.accountLocked) {
          throw new Error(`계정이 잠겼습니다: ${user.lockReason}`)
        }

        // 로그인 성공
        await prisma.loginHistory.create({
          data: {
            userId: user.id,
            loginMethod: 'PASSWORD',
            success: true,
            ipAddress: 'server',
            userAgent: 'NextAuth'
          }
        })

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
    strategy: "jwt",
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
        session.user.id = token.id as string
        session.user.role = token.role as string
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

#### 2.2 인증 유틸리티 함수
**파일**: `lib/auth/next-auth.ts`

```typescript
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()
  
  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.userProfile.findUnique({
    where: { id: session.user.id },
    include: { organization: true }
  })

  return user
}
```

### Phase 3: 기존 코드 전환 (3-5일)

#### 3.1 lib/supabase를 lib/auth-legacy로 이동
```bash
mv lib/supabase lib/auth-legacy
```

README 추가:
```markdown
# lib/auth-legacy

**레거시 코드**: Supabase Auth 사용 코드
**상태**: 더 이상 사용하지 않음
**참조용으로만 유지**

다른 프로젝트에서 Supabase를 사용할 수 있으므로 제거하지 않음.
```

#### 3.2 주요 페이지 수정

**파일 목록** (30+ 파일):
- `app/auth/signin/page.tsx` - 로그인
- `app/auth/signup/page.tsx` - 회원가입  
- `app/auth/callback/page.tsx` - 콜백
- `lib/hooks/useAuth.tsx` - 인증 훅
- `middleware.ts` - 미들웨어
- 모든 (authenticated) 페이지들

**변경 예시**:
```typescript
// Before (Supabase)
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
const { data: { session } } = await supabase.auth.getSession()

// After (NextAuth)
import { useSession } from 'next-auth/react'
const { data: session } = useSession()
```

### Phase 4: 비밀번호 마이그레이션 (1일)

#### 4.1 기존 사용자 처리
**문제**: Supabase에 저장된 비밀번호를 가져올 수 없음

**해결책 1**: 임시 비밀번호 발급
```typescript
// scripts/migrate-user-passwords.ts
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { sendEmail } from '@/lib/email'
import crypto from 'crypto'

async function migratePasswords() {
  const users = await prisma.userProfile.findMany({
    where: { passwordHash: null }
  })

  for (const user of users) {
    // 임시 비밀번호 생성
    const tempPassword = crypto.randomBytes(8).toString('hex')
    const hashedPassword = await bcrypt.hash(tempPassword, 10)

    // 업데이트
    await prisma.userProfile.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword }
    })

    // 이메일 발송
    await sendEmail({
      to: user.email,
      subject: '시스템 전환 - 임시 비밀번호 발급',
      html: `
        <p>안녕하세요, ${user.fullName}님</p>
        <p>시스템 전환으로 ���해 임시 비밀번호가 발급되었습니다.</p>
        <p><strong>임시 비밀번호: ${tempPassword}</strong></p>
        <p>로그인 후 반드시 비밀번호를 변경해주세요.</p>
      `
    })
  }
}
```

**해결책 2**: 비밀번호 재설정 링크
```typescript
// 모든 사용자에게 재설정 링크 발송
for (const user of users) {
  const token = crypto.randomBytes(32).toString('hex')
  
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expires: new Date(Date.now() + 7 * 24 * 3600000) // 7일
    }
  })

  await sendEmail({
    to: user.email,
    subject: '시스템 전환 - 비밀번호 설정',
    html: `
      <p>시스템이 전환되었습니다.</p>
      <a href="${process.env.NEXT_PUBLIC_URL}/auth/reset-password?token=${token}">
        비밀번호 설정하기
      </a>
    `
  })
}
```

### Phase 5: 테스트 (2-3일)

#### 5.1 테스트 항목
- [ ] 로그인/로그아웃
- [ ] 세션 유지
- [ ] 권한 확인
- [ ] 비밀번호 재설정
- [ ] OTP 통합
- [ ] 관리자 승인 플로우

#### 5.2 성능 테스트
- 로그인 응답 시간
- 세션 검증 시간
- 동시 접속 테스트

### Phase 6: 배포 (1일)

#### 6.1 환경변수 설정 (NCP)
```env
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=production-secret
JWT_SECRET=production-jwt-secret
```

#### 6.2 데이터베이스 마이그레이션
```bash
npx prisma db push
```

#### 6.3 사용자 안내
- 기존 사용자에게 비밀번호 재설정 안내 이메일
- 로그인 방법 변경 공지

## 주의사항

### 1. Supabase 패키지 유지
- `@supabase/*` 패키지는 제거하지 않음
- 다른 프로젝트에서 사용할 수 있음
- 이 프로젝트에서만 사용하지 않음

### 2. 레거시 코드 보존
- `lib/supabase` → `lib/auth-legacy`로 이동
- README 추가하여 레거시 표시
- 참조용으로 유지

### 3. 점진적 전환
- 핵심 인증부터 전환
- 페이지별로 단계적 업데이트
- 문제 발생 시 롤백 가능하도록 준비

## 롤백 계획

만약 문제 발생 시:
1. `lib/auth-legacy`를 다시 `lib/supabase`로 복구
2. NextAuth 관련 코드 제거
3. 데이터베이스 passwordHash 필드는 유지 (NULL 허용)

## 체크리스트

### 준비
- [x] NextAuth.js 설치
- [x] 필요한 패키지 설치
- [ ] Prisma 스키마 업데이트
- [ ] 환경변수 설정

### 구현
- [ ] NextAuth API 라우트 생성
- [ ] 인증 유틸리티 함수 작성
- [ ] lib/supabase → lib/auth-legacy 이동
- [ ] 로그인 페이지 수정
- [ ] 회원가입 페이지 수정
- [ ] useAuth 훅 수정
- [ ] 미들웨어 수정
- [ ] 모든 인증 페이지 수정

### 마이그레이션
- [ ] 비밀번호 마이그레이션 스크립트 작성
- [ ] 테스트 실행
- [ ] 이메일 발송 확인

### 배포
- [ ] NCP 환경변수 설정
- [ ] 데이터베이스 마이그레이션
- [ ] 사용자 안내

## 예상 일정

| 작업 | 소요 시간 | 비고 |
|------|----------|------|
| Phase 1: 인프라 준비 | 1-2일 | Prisma 스키마, 환경변수 |
| Phase 2: NextAuth 설정 | 1일 | API 라우트, 유틸리티 |
| Phase 3: 코드 전환 | 3-5일 | 30+ 파일 수정 |
| Phase 4: 비밀번호 마이그레이션 | 1일 | 스크립트 작성 및 실행 |
| Phase 5: 테스트 | 2-3일 | 기능/성능 테스트 |
| Phase 6: 배포 | 1일 | 환경 설정, 사용자 안내 |
| **총계** | **9-13일** | 약 2-3주 |

## 다음 단계

사용자 확인 후 진행:
1. Prisma 스키마 수정
2. 데이터베이스 마이그레이션
3. NextAuth API 라우트 생성

---

**작성자**: Claude AI Assistant
**최종 업데이트**: 2025-10-25
