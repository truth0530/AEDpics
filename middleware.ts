import { type NextRequest, NextResponse } from "next/server";
import { ROLE_ACCESS_MATRIX } from "@/lib/auth/role-matrix";
import { UserRole } from "@/packages/types";
import { getToken } from "next-auth/jwt";

async function getUserRole(request: NextRequest): Promise<UserRole | null> {
  try {
    // NextAuth JWT 토큰에서 사용자 정보 가져오기
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    if (!token?.id) return null;

    // 토큰에 role 정보가 있으므로 바로 사용
    const role = token.role as UserRole;

    // 로깅 추가 - 역할 불일치 감지
    if (role && !ROLE_ACCESS_MATRIX[role]) {
      console.error(`[Middleware] Unknown role detected: ${role} for user ${token.id}`);
    }

    return role || null;
  } catch (error) {
    console.error('[Middleware] Error getting user role:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for public HTML files, presentation, and tutorial pages
  if (
    pathname.endsWith('.html') ||
    pathname.endsWith('.json') ||
    pathname === '/tutorial' ||
    pathname === '/presentation' ||
    pathname.startsWith('/presentation.') ||
    pathname.startsWith('/auth') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // Check role-based access for protected routes
  const userRole = await getUserRole(request);

  // /devices 레거시 경로 처리 (301 영구 리다이렉트)
  if (pathname === '/devices') {
    const inspectionUrl = new URL('/inspection', request.url);
    return NextResponse.redirect(inspectionUrl, 301);
  }

  // 보호된 경로 목록
  const protectedRoutes = ['/dashboard', '/inspection', '/aed-data', '/admin', '/profile', '/team-dashboard'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  // 인증되지 않은 사용자 처리
  if (!userRole && isProtectedRoute) {
    const loginUrl = new URL('/auth/signin', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (userRole) {
    // 역할 검증
    const accessRights = ROLE_ACCESS_MATRIX[userRole];
    if (!accessRights) {
      // 알 수 없는 역할 - 모니터링을 위한 로깅
      console.error(`[Critical] Invalid role '${userRole}' for path ${pathname}`);
      const fallbackUrl = new URL('/pending-approval', request.url);
      return NextResponse.redirect(fallbackUrl);
    }

    // /admin 접근 제어 (master, emergency_center_admin, regional_emergency_center_admin 접근 가능)
    if (pathname.startsWith('/admin')) {
      const adminRoles: UserRole[] = ['master', 'emergency_center_admin', 'regional_emergency_center_admin'];
      if (!adminRoles.includes(userRole)) {
        console.warn(`[Middleware] Unauthorized admin access attempt by ${userRole}`);
        const fallbackUrl = new URL(accessRights.fallbackRoute, request.url);
        return NextResponse.redirect(fallbackUrl);
      }
    }

    // /inspection 접근 제어
    if (pathname.startsWith('/inspection')) {
      if (!accessRights.canAccessInspection) {
        const fallbackUrl = new URL(accessRights.fallbackRoute, request.url);
        return NextResponse.redirect(fallbackUrl);
      }
    }

    // /aed-data 접근 제어
    if (pathname.startsWith('/aed-data')) {
      if (!accessRights.canAccessAEDData) {
        const fallbackUrl = new URL(accessRights.fallbackRoute, request.url);
        return NextResponse.redirect(fallbackUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (.html, .xml, .txt, .webmanifest)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - tutorial page
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|presentation.*|.*\\.html$|.*\\.xml$|.*\\.txt$|.*\\.json$|.*\\.webmanifest$|tutorial|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
