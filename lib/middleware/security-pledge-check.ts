import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isPublicEmailDomain } from '@/lib/auth/config';

/**
 * 임시점검원이 보안 서약서를 작성해야 하는지 확인
 * @param request NextRequest 객체
 * @returns 서약서 작성 필요 여부
 */
export async function needsSecurityPledge(request: NextRequest): Promise<boolean> {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token?.email || !token?.id) return false;

    // 공공기관 도메인 사용자는 서약서 불필요
    if (isPublicEmailDomain(token.email as string)) {
      return false;
    }

    // temporary_inspector 역할인 경우만 서약서 필요
    const role = token.role as string;
    if (role !== 'temporary_inspector') {
      return false;
    }

    // 이미 서약서를 작성했는지 확인
    // 주의: middleware에서는 DB 직접 접근 불가,
    // 토큰에 hasPledge 정보를 저장하거나 별도 API 호출 필요
    const hasPledge = token.hasPledge as boolean;

    return !hasPledge;
  } catch (error) {
    console.error('[SecurityPledgeCheck] Error:', error);
    return false;
  }
}

/**
 * 보호된 경로인지 확인 (서약서 페이지 제외)
 */
export function isProtectedFromPledge(pathname: string): boolean {
  const exemptPaths = [
    '/auth',
    '/api',
    '/security-pledge',
    '/_next',
    '/pending-approval',
    '/profile'
  ];

  return exemptPaths.some(path => pathname.startsWith(path));
}