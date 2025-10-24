/**
 * JWT Authentication Utilities
 *
 * jose 라이브러리를 사용한 JWT 토큰 생성 및 검증
 * - Access Token (7일)
 * - Refresh Token (30일)
 * - 보안 강화: HS256 알고리즘
 */

import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/db/prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-very-secure-jwt-secret-minimum-32-characters'
);

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_ISSUER = 'aedpics-ncp';
const JWT_AUDIENCE = 'aedpics-users';

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  organization?: string;
}

/**
 * Access Token 생성
 */
export async function createAccessToken(payload: JWTPayload): Promise<string> {
  const expiresIn = parseExpiration(JWT_EXPIRES_IN);

  const token = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    organization: payload.organization,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Access Token 검증
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    return {
      userId: payload.userId as number,
      email: payload.email as string,
      role: payload.role as string,
      organization: payload.organization as string | undefined,
    };
  } catch (error) {
    console.error('[JWT] Token verification failed:', error);
    return null;
  }
}

/**
 * Token에서 사용자 정보 추출 (검증 없이)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      organization: payload.organization,
    };
  } catch (error) {
    console.error('[JWT] Token decode failed:', error);
    return null;
  }
}

/**
 * 만료 시간 파싱 (예: "7d" → 7일 후 timestamp)
 */
function parseExpiration(exp: string): string {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) return '7d';

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const now = Math.floor(Date.now() / 1000);
  let seconds = 0;

  switch (unit) {
    case 's':
      seconds = value;
      break;
    case 'm':
      seconds = value * 60;
      break;
    case 'h':
      seconds = value * 60 * 60;
      break;
    case 'd':
      seconds = value * 24 * 60 * 60;
      break;
  }

  return `${now + seconds}`;
}

/**
 * 사용자 인증 및 토큰 생성
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ token: string; user: any } | null> {
  const bcrypt = await import('bcryptjs');

  // 사용자 조회
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });

  if (!user || !user.password) {
    console.log('[Auth] User not found or no password:', email);
    return null;
  }

  // 비밀번호 검증
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    console.log('[Auth] Invalid password for user:', email);
    return null;
  }

  // 이메일 인증 여부 확인
  if (!user.emailVerified) {
    console.log('[Auth] Email not verified:', email);
    return null;
  }

  // JWT 토큰 생성
  const token = await createAccessToken({
    userId: user.id,
    email: user.email,
    role: user.profile?.role || 'viewer',
    organization: user.profile?.organization || undefined,
  });

  // 로그인 히스토리 기록
  await prisma.loginHistory.create({
    data: {
      userId: user.id,
      ipAddress: null, // API 라우트에서 설정
      userAgent: null, // API 라우트에서 설정
    },
  });

  // lastLoginAt 업데이트
  if (user.profile) {
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { lastLoginAt: new Date() },
    });
  }

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.profile?.role,
      organization: user.profile?.organization,
    },
  };
}

/**
 * 사용자 등록 및 토큰 생성
 */
export async function registerUser(data: {
  email: string;
  password: string;
  name?: string;
  role?: string;
  organization?: string;
}): Promise<{ token: string; user: any } | null> {
  const bcrypt = await import('bcryptjs');

  // 이메일 중복 확인
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    console.log('[Auth] Email already exists:', data.email);
    return null;
  }

  // 비밀번호 해싱
  const hashedPassword = await bcrypt.hash(data.password, 10);

  // 사용자 생성
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      emailVerified: false, // OTP 인증 후 true로 변경
      profile: {
        create: {
          role: data.role || 'viewer',
          organization: data.organization,
        },
      },
    },
    include: { profile: true },
  });

  // JWT 토큰 생성 (이메일 미인증 상태)
  const token = await createAccessToken({
    userId: user.id,
    email: user.email,
    role: user.profile?.role || 'viewer',
    organization: user.profile?.organization || undefined,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.profile?.role,
      organization: user.profile?.organization,
      emailVerified: user.emailVerified,
    },
  };
}

/**
 * 비밀번호 변경
 */
export async function changePassword(
  userId: number,
  oldPassword: string,
  newPassword: string
): Promise<boolean> {
  const bcrypt = await import('bcryptjs');

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.password) {
    return false;
  }

  // 기존 비밀번호 검증
  const isValid = await bcrypt.compare(oldPassword, user.password);
  if (!isValid) {
    return false;
  }

  // 새 비밀번호 해싱
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // 비밀번호 업데이트
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return true;
}

/**
 * 비밀번호 재설정 토큰 생성
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return null;
  }

  // 랜덤 토큰 생성
  const token = await new SignJWT({ userId: user.id, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h') // 1시간 후 만료
    .sign(JWT_SECRET);

  // 데이터베이스에 토큰 저장
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1시간
    },
  });

  return token;
}

/**
 * 비밀번호 재설정 토큰 검증 및 비밀번호 변경
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<boolean> {
  const bcrypt = await import('bcryptjs');

  try {
    // 토큰 검증
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as number;

    // 데이터베이스에서 토큰 확인
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        token,
        userId,
        expiresAt: { gte: new Date() },
      },
    });

    if (!resetRecord) {
      console.log('[Auth] Invalid or expired reset token');
      return false;
    }

    // 새 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 비밀번호 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // 사용된 토큰 삭제
    await prisma.passwordReset.delete({
      where: { id: resetRecord.id },
    });

    return true;
  } catch (error) {
    console.error('[Auth] Password reset failed:', error);
    return false;
  }
}
