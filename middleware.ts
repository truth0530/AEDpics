/**
 * Next.js Middleware
 *
 * Features:
 * - JWT token verification
 * - Session timeout check
 * - Security headers
 * - Route protection
 *
 * NIS Certification: Authentication & Session Management
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { isSessionActive, updateSessionActivity } from '@/lib/middleware/session-timeout';
import { isRequestAllowedByIP, getIPWhitelistRejectionMessage } from '@/lib/middleware/ip-whitelist';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/verify-email',
  '/reset-password',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/verify-otp',
  '/api/auth/send-otp',
  '/api/auth/reset-password',
];

// API routes that require authentication
const PROTECTED_API_ROUTES = [
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/2fa',
  '/api/aed-data',
  '/api/inspections',
  '/api/upload',
  '/api/admin',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check IP whitelist
  if (!isRequestAllowedByIP(request)) {
    const message = getIPWhitelistRejectionMessage(request);

    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return new NextResponse(
      `<html><body><h1>Access Denied</h1><p>${message}</p></body></html>`,
      { status: 403, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    // Add security headers to public routes
    return addSecurityHeaders(NextResponse.next());
  }

  // Get JWT token from cookie or Authorization header
  const token =
    request.cookies.get('auth-token')?.value ||
    request.headers.get('authorization')?.slice(7);

  if (!token) {
    // No token, redirect to login
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Verify JWT token
  const payload = await verifyAccessToken(token);

  if (!payload) {
    // Invalid token, redirect to login
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Check session timeout
  const sessionActive = await isSessionActive(payload.userId);

  if (!sessionActive) {
    // Session expired, redirect to login
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('session_expired', 'true');
    return NextResponse.redirect(url);
  }

  // Update session activity (extend session)
  await updateSessionActivity(payload.userId);

  // Add user info to request headers
  const response = NextResponse.next();
  response.headers.set('x-user-id', payload.userId.toString());
  response.headers.set('x-user-email', payload.email);
  response.headers.set('x-user-role', payload.role);

  return addSecurityHeaders(response);
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // NIS Certification: Security Headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
