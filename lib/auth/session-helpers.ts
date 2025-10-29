import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import type { user_profiles, organizations } from '@prisma/client';

export interface AuthResult {
  session: Session;
  userId: string;
}

export interface AuthWithProfileResult extends AuthResult {
  profile: user_profiles;
}

export interface AuthWithOrganizationResult extends AuthWithProfileResult {
  organization: organizations;
}

/**
 * 세션 인증을 요구하는 헬퍼 함수
 * @returns 인증 성공 시 session과 userId 반환, 실패 시 401 NextResponse 반환
 */
export async function requireAuth(): Promise<
  AuthResult | NextResponse
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return {
    session,
    userId: session.user.id,
  };
}

/**
 * 세션 + 사용자 프로필 조회를 요구하는 헬퍼 함수
 * @param select Prisma select 옵션 (선택적)
 * @returns 인증 성공 시 session, userId, profile 반환, 실패 시 401/404 NextResponse 반환
 */
export async function requireAuthWithProfile<T = user_profiles>(
  select?: Record<string, boolean>
): Promise<
  (AuthResult & { profile: T }) | NextResponse
> {
  const authResult = await requireAuth();

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const profile = await prisma.user_profiles.findUnique({
    where: { id: authResult.userId },
    select: select as any,
  });

  if (!profile) {
    return NextResponse.json(
      { error: 'User profile not found' },
      { status: 404 }
    );
  }

  return {
    ...authResult,
    profile: profile as T,
  };
}

/**
 * 세션 + 사용자 프로필 + 소속 조직 조회를 요구하는 헬퍼 함수
 * @returns 인증 성공 시 session, userId, profile, organization 반환, 실패 시 401/404 NextResponse 반환
 */
export async function requireAuthWithOrganization(): Promise<
  AuthWithOrganizationResult | NextResponse
> {
  const authResult = await requireAuthWithProfile({
    id: true,
    email: true,
    name: true,
    role: true,
    organization_id: true,
    assigned_devices: true,
    created_at: true,
    updated_at: true,
  });

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!authResult.profile.organization_id) {
    return NextResponse.json(
      { error: 'User is not associated with an organization' },
      { status: 403 }
    );
  }

  const organization = await prisma.organizations.findUnique({
    where: { id: authResult.profile.organization_id },
  });

  if (!organization) {
    return NextResponse.json(
      { error: 'Organization not found' },
      { status: 404 }
    );
  }

  return {
    ...authResult,
    organization,
  };
}

/**
 * TypeScript Type Guard: NextResponse 여부 확인
 * @param result requireAuth 계열 함수의 반환값
 * @returns NextResponse이면 true, AuthResult이면 false
 */
export function isErrorResponse(
  result: any
): result is NextResponse {
  return result instanceof NextResponse;
}
