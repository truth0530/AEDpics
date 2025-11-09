/**
 * API 라우트 권한 검증 헬퍼
 * 모든 라우트에서 일관되게 권한을 검증하기 위한 유틸리티
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithProfile, isErrorResponse } from './session-helpers';
import { checkPermission, getPermissionError } from './permissions';
import { UserRole } from '@/packages/types';
import type { PERMISSIONS } from './permissions';

/**
 * API 라우트에서 사용할 권한 검증 헬퍼
 *
 * 사용 예시:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const auth = await requirePermissionForRoute(request, 'APPROVE_USERS');
 *   if (!auth.success) return auth.response;
 *
 *   const { profile } = auth;
 *   // 비즈니스 로직...
 * }
 * ```
 */
export async function requirePermissionForRoute(
  request: NextRequest,
  permission: keyof typeof PERMISSIONS
): Promise<
  | { success: false; response: NextResponse }
  | { success: true; profile: any; role: UserRole }
> {
  // Step 1: 인증 확인
  const authResult = await requireAuthWithProfile();
  if (isErrorResponse(authResult)) {
    return {
      success: false,
      response: authResult as NextResponse
    };
  }

  const { profile } = authResult;

  // Step 2: 권한 검증
  if (!checkPermission(profile.role, permission)) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: getPermissionError(permission),
          code: 'PERMISSION_DENIED'
        },
        { status: 403 }
      )
    };
  }

  // Step 3: 성공 - 프로필 및 역할 반환
  return {
    success: true,
    profile,
    role: profile.role
  };
}

/**
 * 역할 기반 권한 검증 헬퍼
 *
 * 사용 예시:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const auth = await requireRoleForRoute(request, ['master', 'emergency_center_admin']);
 *   if (!auth.success) return auth.response;
 *
 *   const { profile } = auth;
 *   // 비즈니스 로직...
 * }
 * ```
 */
export async function requireRoleForRoute(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<
  | { success: false; response: NextResponse }
  | { success: true; profile: any; role: UserRole }
> {
  // Step 1: 인증 확인
  const authResult = await requireAuthWithProfile();
  if (isErrorResponse(authResult)) {
    return {
      success: false,
      response: authResult as NextResponse
    };
  }

  const { profile } = authResult;

  // Step 2: 역할 검증
  if (!allowedRoles.includes(profile.role)) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: `이 작업을 수행할 권한이 없습니다. 필요한 역할: ${allowedRoles.join(', ')}`,
          code: 'INVALID_ROLE'
        },
        { status: 403 }
      )
    };
  }

  // Step 3: 성공 - 프로필 및 역할 반환
  return {
    success: true,
    profile,
    role: profile.role
  };
}

/**
 * 간단한 인증 확인 헬퍼 (권한 검증 없음)
 *
 * 사용 예시:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAuthForRoute(request);
 *   if (!auth.success) return auth.response;
 *
 *   const { profile } = auth;
 *   // 비즈니스 로직...
 * }
 * ```
 */
export async function requireAuthForRoute(
  request: NextRequest
): Promise<
  | { success: false; response: NextResponse }
  | { success: true; profile: any; role: UserRole }
> {
  const authResult = await requireAuthWithProfile();
  if (isErrorResponse(authResult)) {
    return {
      success: false,
      response: authResult as NextResponse
    };
  }

  const { profile } = authResult;
  return {
    success: true,
    profile,
    role: profile.role
  };
}

/**
 * 권한이 있는 경우만 비즈니스 로직 실행
 * 함수형 패턴 사용
 *
 * 사용 예시:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   return await withPermission(
 *     request,
 *     'APPROVE_USERS',
 *     async (profile) => {
 *       // 비즈니스 로직
 *       return NextResponse.json({ success: true });
 *     }
 *   );
 * }
 * ```
 */
export async function withPermission(
  request: NextRequest,
  permission: keyof typeof PERMISSIONS,
  handler: (profile: any) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await requirePermissionForRoute(request, permission);
  if ('response' in auth) {
    return auth.response;
  }
  return handler(auth.profile);
}

/**
 * 특정 역할만 접근 가능하게 제한
 *
 * 사용 예시:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   return await withRole(
 *     request,
 *     ['master', 'emergency_center_admin'],
 *     async (profile) => {
 *       // 비즈니스 로직
 *       return NextResponse.json({ success: true });
 *     }
 *   );
 * }
 * ```
 */
export async function withRole(
  request: NextRequest,
  allowedRoles: UserRole[],
  handler: (profile: any) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await requireRoleForRoute(request, allowedRoles);
  if ('response' in auth) {
    return auth.response;
  }
  return handler(auth.profile);
}

/**
 * 인증만 확인 (권한 검증 없음)
 *
 * 사용 예시:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   return await withAuth(
 *     request,
 *     async (profile) => {
 *       // 비즈니스 로직
 *       return NextResponse.json({ success: true });
 *     }
 *   );
 * }
 * ```
 */
export async function withAuth(
  request: NextRequest,
  handler: (profile: any) => Promise<NextResponse>
): Promise<NextResponse> {
  const auth = await requireAuthForRoute(request);
  if ('response' in auth) {
    return auth.response;
  }
  return handler(auth.profile);
}
