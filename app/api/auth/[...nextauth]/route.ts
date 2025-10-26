import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

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
          throw new Error("이메일과 비밀번호를 입력해주세요")
        }

        const user = await prisma.user_profiles.findUnique({
          where: { email: credentials.email },
          include: { organizations: true }
        })

        if (!user || !user.password_hash) {
          throw new Error("이메일 또는 비밀번호가 일치하지 않습니다")
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        )

        if (!isValid) {
          throw new Error("이메일 또는 비밀번호가 일치하지 않습니다")
        }

        if (!user.is_active) {
          throw new Error("계정이 비활성화되었습니다")
        }

        if (user.account_locked) {
          throw new Error(`계정이 잠겼습니다: ${user.lock_reason || '관리자에게 문의하세요'}`)
        }

        // 로그인 성공 - 이력 기록
        await prisma.login_history.create({
          data: {
            user_id: user.id,
            success: true,
            ip_address: 'server',
            user_agent: 'NextAuth'
          }
        })

        // lastLoginAt 업데이트
        await prisma.user_profiles.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organizationName
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
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
