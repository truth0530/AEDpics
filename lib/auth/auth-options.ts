import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          logger.warn('Auth:authorize', 'Missing credentials');
          throw new Error("이메일과 비밀번호를 입력해주세요")
        }

        const user = await prisma.user_profiles.findUnique({
          where: { email: credentials.email },
          include: { organizations: true }
        })

        if (!user || !user.password_hash) {
          logger.warn('Auth:authorize', 'Invalid credentials', { email: credentials.email });
          throw new Error("이메일 또는 비밀번호가 일치하지 않습니다")
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        )

        if (!isValid) {
          logger.warn('Auth:authorize', 'Invalid password', { userId: user.id });
          throw new Error("이메일 또는 비밀번호가 일치하지 않습니다")
        }

        if (!user.is_active) {
          logger.warn('Auth:authorize', 'Inactive account', { userId: user.id });
          throw new Error("계정이 비활성화되었습니다")
        }

        if (user.account_locked) {
          logger.warn('Auth:authorize', 'Locked account', { userId: user.id, reason: user.lock_reason });
          throw new Error(`계정이 잠겼습니다: ${user.lock_reason || '관리자에게 문의하세요'}`)
        }

        // 로그인 성공 - 이력 기록
        await prisma.login_history.create({
          data: {
            id: randomUUID(),
            user_id: user.id,
            success: true,
            ip_address: 'server',
            user_agent: 'NextAuth'
          }
        })

        // last_login_at 업데이트
        await prisma.user_profiles.update({
          where: { id: user.id },
          data: { last_login_at: new Date() }
        })

        logger.info('Auth:authorize', 'Login successful', { userId: user.id, email: user.email });

        return {
          id: user.id,
          email: user.email,
          name: user.full_name,
          role: user.role,
          organizationId: user.organization_id,
          organizationName: user.organization_name
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
        token.organizationId = user.organizationId
        token.organizationName = user.organizationName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.organizationId = token.organizationId as string
        session.user.organizationName = token.organizationName as string
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
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
  },
  secret: env.NEXTAUTH_SECRET,
}
